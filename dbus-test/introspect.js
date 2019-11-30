const path = require('path')

const chai = require('chai')
const expect = chai.expect

const DBus = require('src/dbus')

describe(path.basename(__filename), () => {
  it('should connect to dbus successfully', done => {
    const bus = new DBus()
    bus.on('connect', () => {
      done()
    })
  })

  it('Ping on Peer of org.freedesktop.DBus', done => {
    const bus = new DBus()
    bus.on('connect', () => {
      bus.methodCall({
        destination: 'org.freedesktop.DBus',
        path: '/org/freedesktop/DBus',
        'interface': 'org.freedesktop.DBus.Peer',
        member: 'Ping',
      }, done)
    })
  })

  it('GetMachineId on Peer of org.freedesktop.DBus', done => {
    const bus = new DBus()
    bus.on('connect', () => {
      bus.methodCall({
        destination: 'org.freedesktop.DBus',
        path: '/org/freedesktop/DBus',
        'interface': 'org.freedesktop.DBus.Peer',
        member: 'GetMachineId'
      }, (err, body) => {
        expect(body[0].value).to.equal(bus.machineId)
        done()
      })
    })
  })
})



