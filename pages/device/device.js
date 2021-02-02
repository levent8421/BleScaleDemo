import ScaleApi from '../../utils/ScaleApi';
// pages/device/device.js
const showModal = (title, msg) => {
    wx.showModal({
        title: title,
        content: msg,
    })
};
Page({
    data: {
        device: {},
        status: '连接中...',
    },

    onLoad: function (options) {
        const eventChannel = this.getOpenerEventChannel();
        const _this = this;
        eventChannel.on('device', res => {
            this.device = res;
            _this.setData({
                device: res
            });
            _this.connect();
        });
    },
    connect() {
        const _this = this;
        const {
            deviceId
        } = this.device;
        this.scaleApi = new ScaleApi({
            deviceId: deviceId
        });
        this.scaleApi.connect().then(res => {
            console.log('Connect success', res);
            _this.setData({
                status: '连接成功'
            });
        }).catch(err => {
            console.log('Connect error:', err);
            _this.setData({
                status: '连接失败'
            });
        });
    },
    eGetWeight() {
        this.scaleApi.getWeight().then(res => {
            const text = JSON.stringify(res);
            showModal('重量获取成功', text);
        }).catch(err => {
            console.log(err);
        })
    },
    eGetCapacity() {
        this.scaleApi.getCapacity().then(res => {
            const text = JSON.stringify(res);
            showModal('容量获取成功', text);
        }).catch(err => console.log(err));
    }
})