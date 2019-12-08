const path = require('path')

const chai = require('chai')
const expect = chai.expect

const { BYTE, STRING, ARRAY, DICT_ENTRY, VARIANT } = require('src/types')
const DBus = require('src/dbus')
const Properties = require('src/interfaces/org.freedesktop.DBus.Properties')
const PropertiesImpl = require('src/impls/org.freedesktop.DBus.Properties')
const ReadWrite = require('src/interfaces/com.example.readwrite')

/**
 * There are two props on readwrite interface, Read and ReadWrite
 */
describe(path.basename(__filename) +
  ', test org.freedesktop.DBus.Properties implementation' +
  ' using custom readwrite interface', () => {
  let client, server

  // set up client and server
  beforeEach(done => {
    server = new DBus()
    server.addInterface(Properties)
    server.addInterface(ReadWrite)
    server.addImplementation(PropertiesImpl)

    server.addNode({
      path: '/',
      implementations: [
        'org.freedesktop.DBus.Properties',
        {
          interface: 'com.example.readwrite',
          Read: new STRING('hello'),
          ReadWrite: new STRING('foo')
        }
      ]
    })

    server.on('connect', () => {
      if (client.connected) done()
    })

    client = new DBus()
    client.on('connect', () => {
      if (server.connected) done()
    })
  })

  it('Get Read should succeed', done =>
    client.GetProp(server.myName, '/', 'com.example.readwrite', 'Read',
      (err, body) => {
        if (err) return done(err)
        expect(body).to.deep.equal([new VARIANT(new STRING('hello'))])
        done()
      }))

  it('Get Write should fail with UnknownProperty', done =>
    client.GetProp(server.myName, '/', 'com.example.readwrite', 'Write',
      (err, body) => {
        expect(err).is.an('Error')
        expect(err.code).to.equal('ERR_DBUS_ERROR')
        expect(err.name).to.equal('org.freedesktop.DBus.Error.UnknownProperty')
        done()
      }))

  it('Get ReadWrite should succeed', done =>
    client.GetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
      (err, body) => {
        if (err) return done(err)
        expect(body).to.deep.equal([new VARIANT(new STRING('foo'))])
        done()
      }))

  it('GetAll should return Read and ReadWrite but no Write', done =>
    client.GetAllProps(server.myName, '/', 'com.example.readwrite',
      (err, body) => {
        if (err) return done(err)
        expect(body).to.deep.equal([
          new ARRAY([
            new DICT_ENTRY([
              new STRING('Read'),
              new VARIANT(new STRING('hello'))
            ]),
            new DICT_ENTRY([
              new STRING('ReadWrite'),
              new VARIANT(new STRING('foo'))
            ])
          ])
        ])
        done()
      }))

  it('Set Read should fail with PropertyReadOnly', done =>
    client.SetProp(server.myName, '/', 'com.example.readwrite', 'Read',
      new STRING('bar'),
      (err, body) => {
        expect(err).to.be.an('Error')
        expect(err.name).to.equal('org.freedesktop.DBus.Error.PropertyReadOnly')
        expect(err.code).to.equal('ERR_DBUS_ERROR')
        done()
      }))

  it('Set Write to "bar" should failed with UnknownProperty', done =>
    client.SetProp(server.myName, '/', 'com.example.readwrite', 'Write',
      new STRING('bar'),
      (err, body) => {
        expect(err).to.be.an('Error')
        expect(err.name).to.equal('org.freedesktop.DBus.Error.UnknownProperty')
        expect(err.code).to.equal('ERR_DBUS_ERROR')
        done()
      }))

  it('Set ReadWrite to BYTE should fail with InvalidSignature', done => {
    client.SetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
      new BYTE(2),
      (err, body) => {
        expect(err).to.be.an('Error')
        expect(err.name).to.equal('org.freedesktop.DBus.Error.InvalidSignature')
        expect(err.code).to.equal('ERR_DBUS_ERROR')
        done()
      })
  })

  it('Set ReadWrite to "bar" should succeed', done =>
    client.SetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
      new STRING('bar'),
      (err, body) => {
        expect(err).to.equal(null)
        expect(body).to.equal(undefined)
        done()
      }))

  it('Set ReadWrite to "bar" and read back should be "bar"', done =>
    client.SetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
      new STRING('bar'),
      (err, body) => {
        if (err) return done(err)
        client.GetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
          (err, body) => {
            expect(err).to.equal(null)
            expect(body).to.deep.equal([new VARIANT(new STRING('bar'))])
            done()
          })
      }))

  it('Set ReadWrite to "bar" should emit signal on server', done => {
    client.SetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
      new STRING('bar'), (err, body) => {})

    server.on('signal', s => {
      expect(s.origin.sender).to.equal(client.myName)
      expect(s.path).to.equal('/')
      expect(s.interface).to.equal('org.freedesktop.DBus.Properties')
      expect(s.member).to.equal('PropertiesChanged')
      expect(s.body).to.deep.equal([
        new STRING('com.example.readwrite'),
        new ARRAY([
          new DICT_ENTRY([
            new STRING('ReadWrite'),
            new VARIANT(new STRING('bar'))
          ])
        ]),
        new ARRAY([], 'as')
      ])
      done()
    })
  })

  it('Set ReadWrite should receive signal on client', done => {
    client.AddMatch({
      type: 'signal',
      sender: server.myName,
      interface: 'org.freedesktop.DBus.Properties',
      member: 'PropertiesChanged',
      path_namespace: '/'
    }, err => {
      if (err) return done(err)

      client.SetProp(server.myName, '/', 'com.example.readwrite', 'ReadWrite',
        new STRING('bar'), (err, body) => {})

      client.on('signal', s => {
        expect(s.sender).to.equal(server.myName)
        expect(s.path).to.equal('/')
        expect(s.interface).to.equal('org.freedesktop.DBus.Properties')
        expect(s.member).to.equal('PropertiesChanged')
        expect(s.body).to.deep.equal([
          new STRING('com.example.readwrite'),
          new ARRAY([
            new DICT_ENTRY([
              new STRING('ReadWrite'),
              new VARIANT(new STRING('bar'))
            ])
          ]),
          new ARRAY([], 'as')
        ])
        done()
      })
    })
  })
})