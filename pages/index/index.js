// index.js
// 获取应用实例
import AutoSliceBuffer from '../../utils/AutoSliceBuffer';
const app = getApp()
const buffer = new AutoSliceBuffer({
  sliceSize: 10
});
Page({
  data: {
    devices: [],
  },
  onLoad() {
    const {
      devices
    } = this.data;
    console.log('ready', devices);
  },
  eOpenAndScan() {
    const _this = this;
    wx.onBluetoothDeviceFound((result) => {
      const {
        devices
      } = result;
      _this.cacheDevices(devices);
    });
    wx.openBluetoothAdapter({
      success() {
        console.log('Open BLEAdapter success, scanning......');
        _this.startScan();
      },
      fail(err) {
        console.log('Can not open BLE Adapter!', err);
      }
    });
  },
  startScan() {
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      interval: 500,
      success() {
        console.log('Scanning BLE device......');
      },
      fail(err) {
        console.log('Start scan fail!', err);
      }
    });
  },
  cacheDevices(newDevices) {
    const deviceTable = {};
    const {
      devices
    } = this.data;
    for (let device of devices) {
      deviceTable[device.deviceId] = device;
    }
    for (let device of newDevices) {
      deviceTable[device.deviceId] = device;
    }
    const deviceList = [];
    for (let key in deviceTable) {
      deviceList.push(deviceTable[key]);
    }
    this.setData({
      devices: deviceList
    });
  },
  eToDevice(e) {
    console.log('Stopping scan BLE device...');
    const {
      device
    } = e.currentTarget.dataset;
    const _this = this;
    wx.stopBluetoothDevicesDiscovery({
      success: (res) => {
        console.log('Scanning stopped');
        _this.navToDevice(device);
      }
    });
  },
  navToDevice(device) {
    wx.navigateTo({
      url: '/pages/device/device',
      success(res) {
        res.eventChannel.emit('device', device);
      }
    });
  },
  eTestBuffer() {
    if (!buffer.isEmpty()) {
      console.log('Busy!');
    }
    const data = new ArrayBuffer(105);
    buffer.pushData(data);
  }
})