/**
 * @Author: Levent (levent8421@outlook.com)
 * For :
 * MeiCai BLE Scale device API
 * create at: 2021.2.2. 
 */
import AutoSliceBuffer from './AutoSliceBuffer';
import {
    stringToArrayBuffer
} from './bufferUtils';

const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const WRITE_CHARACTERISTIC_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
const READ_CHARACTERISTIC_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const LINE_END_R = 0x0D;
const LINE_END_N = 0x0A;
const TIMEOUT = 5000;
const DEFAULT_CHANNEL = 0;

const CMD_TABLE = {
    getWeight: stringToArrayBuffer('W\r\n'),
    getCapacity: stringToArrayBuffer('CAPACITY\r\n'),
    doZero: stringToArrayBuffer('Z\r\n'),
    doTare: stringToArrayBuffer('T\r\n'),
    setDecimal(decimal) {
        return stringToArrayBuffer(`DECIMAL ${decimal}\r\n`);
    },
    sendData(channel, length, timeout) {
        return stringToArrayBuffer(`SEND ${channel} ${length} ${timeout}\r\n`);
    }
};

class ScaleApi {
    /**
     * 创建API对象
     * @param {deviceId} options 
     */
    constructor(options) {
        const {
            deviceId
        } = options;
        this.deviceId = deviceId;
        this.sendBuffer = new AutoSliceBuffer({
            sliceSize: 20
        });
        this.recvBuffer = [];
        this.lineBuffer = [];
    }
    /**
     * 连接设备
     * return Promise
     */
    connect() {
        const _this = this;
        return new Promise((resolve, reject) => {
            console.log('Create connection for:', this.deviceId);
            wx.closeBLEConnection({
                deviceId: _this.deviceId,
                complete() {
                    console.log('Close connection for:', _this.deviceId, ' complete, reconnecting...');
                    _this._doConnect(resolve, reject);
                }
            })
        });
    }
    _doConnect(resolve, reject) {
        const _this = this;
        wx.createBLEConnection({
            deviceId: this.deviceId,
            success() {
                console.log('Create connection success!');
                _this._obtainService(resolve, reject);
            },
            fail(err) {
                reject(err);
            }
        });
    }
    _obtainService(resolve, reject) {
        const _this = this;
        const deviceId = this.deviceId;
        console.log('Obtain services with:', deviceId);
        wx.getBLEDeviceServices({
            deviceId: deviceId,
            success(res) {
                const {
                    services
                } = res;
                for (const service of services) {
                    const {
                        uuid
                    } = service;
                    if (SERVICE_UUID == uuid.toLowerCase()) {
                        console.log('Service find complete!');
                        _this._obtainCharacteristic(resolve, reject);
                        return;
                    }
                }
                reject({
                    errMsg: 'Can not find serviceUUID!'
                });
            },
            fail(err) {
                reject(err);
            }
        })
    }
    _obtainCharacteristic(resolve, reject) {
        const _this = this;
        const deviceId = this.deviceId;
        console.log('Obtain read/write charateristic(s)');
        wx.getBLEDeviceCharacteristics({
            deviceId: deviceId,
            serviceId: SERVICE_UUID,
            success(res) {
                const {
                    characteristics
                } = res;
                let readReady = false;
                let writeReady = false;
                for (const characteristic of characteristics) {
                    const {
                        uuid
                    } = characteristic;
                    const commonUuid = uuid.toLowerCase();
                    if (commonUuid == READ_CHARACTERISTIC_UUID) {
                        _this._enableReadNotify(resolve, reject);
                        readReady = true;
                    }
                    if (commonUuid == WRITE_CHARACTERISTIC_UUID) {
                        writeReady = true;
                    }
                }
                if (!readReady || !writeReady) {
                    reject({
                        errMsg: 'Read or write not ready!',
                        read: readReady,
                        write: writeReady
                    });
                }
            },
            fail(err) {
                reject(err);
            }
        })
    }
    _enableReadNotify(resolve, reject) {
        console.log('Enable notify!');
        const deviceId = this.deviceId;
        const _this = this;
        wx.notifyBLECharacteristicValueChange({
            characteristicId: READ_CHARACTERISTIC_UUID,
            deviceId: deviceId,
            serviceId: SERVICE_UUID,
            state: true,
            success() {
                resolve(_this);
            },
            fail(err) {
                reject(err);
            }
        });
        wx.onBLECharacteristicValueChange(result => {
            const {
                value
            } = result;
            _this._onReceive(value);
        });
    }
    _onReceive(data) {
        const buffer = new Uint8Array(data);
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            if (byte == LINE_END_N || byte == LINE_END_R) {
                if (this.lineBuffer.length <= 0) {
                    continue;
                }
                console.log('line', this.lineBuffer);
                this.recvBuffer.push(this.lineBuffer);
                this._onNewLine(this.lineBuffer);
                this.lineBuffer = [];
                continue;
            }
            this.lineBuffer.push(byte);
        }
    }
    _onNewLine(line) {
        if (this.newLineResolve) {
            let str = '';
            for (const c of line) {
                const char = String.fromCharCode(c);
                str += char;
            }
            this.newLineResolve(str);
            this.newLineResolve = null;
        }
        if (this.timeoutTask) {
            clearTimeout(this.timeoutTask);
            this.timeoutTask = null;
        }
    }
    _resetReceBuffer() {
        this.lineBuffer = [];
        this.recvBuffer = [];
    }
    _send(data) {
        const _this = this;
        return new Promise((resolve, reject) => {
            if (!_this.sendBuffer.isEmpty()) {
                reject({
                    errMsg: 'Send busy!'
                });
                return;
            }
            this._resetReceBuffer();
            _this.sendBuffer.pushData(data);
            _this._sendNext(resolve, reject);
        });
    }
    _sendNext(resolve, reject) {
        if (this.sendBuffer.isEmpty()) {
            resolve(this);
            return;
        }
        const deviceId = this.deviceId;
        const _this = this;
        const data = this.sendBuffer.getSlice();
        wx.writeBLECharacteristicValue({
            characteristicId: WRITE_CHARACTERISTIC_UUID,
            deviceId: deviceId,
            serviceId: SERVICE_UUID,
            value: data,
            success() {
                _this._sendNext(resolve, reject);
            },
            fail(err) {
                reject(err);
            }
        })
    }
    async _sendForResponse(data, resolve, reject, timeout = TIMEOUT) {
        await this._send(data);
        this.timeoutTask = setTimeout(() => {
            reject({
                errMsg: 'timeout'
            });
        }, timeout);
        this.newLineResolve = resolve;
    }
    _sendForResponseSync(data, timeout = TIMEOUT) {
        const _this = this;
        return new Promise((resolve, reject) => {
            _this._sendForResponse(data, resolve, reject, timeout);
        });
    }
    _sendWithProtocol(cmd, minItems, onOk, onError, expectedStatus = 'A') {
        this._sendForResponseSync(cmd).then(resp => {
            const items = resp.split(' ');
            if (items.length < minItems) {
                onError({
                    errMsg: `Invalidate Response length:${resp}`
                });
                return;
            }
            const status = items[1];
            if (status != expectedStatus) {
                onError({
                    errMsg: `Invalidate status:${resp}`
                });
                return;
            }
            onOk(items);
        });
    }
    /**
     * 获取重量
     * return Promise
     * resolve: {
     *  gross: 毛重
     *  status: S/D 稳定，不稳定
     *  tare: 皮重
     *  net: 净重
     * }
     */
    getWeight() {
        const _this = this;
        const cmd = CMD_TABLE.getWeight;
        return new Promise((resolve, reject) => {
            _this._sendWithProtocol(cmd, 7, items => {
                resolve({
                    status: items[3],
                    gross: items[4],
                    tare: items[5],
                    net: items[6]
                });
            }, reject);
        });
    }
    /**
     * 获取最大量程
     * return Promise
     * resolve{
     *  capacity: 量程
     *  unit: 单位： g or kg
     * }
     */
    getCapacity() {
        const cmd = CMD_TABLE.getCapacity;
        const _this = this;
        return new Promise((resolve, reject) => {
            _this._sendWithProtocol(cmd, 4, items => {
                resolve({
                    capacity: items[2],
                    unit: items[3],
                });
            }, reject);
        });
    }
    /**
     * 清零
     * return Promise
     */
    doZero() {
        const _this = this;
        const cmd = CMD_TABLE.doZero;
        return new Promise((resolve, reject) => {
            _this._sendWithProtocol(cmd, 2, items => {
                resolve(_this);
            }, reject);
        });
    }
    /**
     * 去皮
     * return Promise
     */
    doTare() {
        const _this = this;
        const cmd = CMD_TABLE.doTare;
        return new Promise((resolve, reject) => {
            _this._sendWithProtocol(cmd, 2, items => {
                resolve(_this);
            }, reject);
        });
    }
    /**
     * 设置小数位数
     * @param {小数位数} decimal 0,1,2,3
     */
    setDecimal(decimal) {
        const cmd = CMD_TABLE.setDecimal(decimal);
        const _this = this;
        return new Promise((resolve, reject) => {
            _this._sendWithProtocol(cmd, 2, resolve, reject);
        });
    }
    /**
     * 发送数据
     * @param {数据} data ArrayBuffer
     * @param {超时时间} timeout 毫秒 
     */
    sendData(data, timeout) {
        const cmd = CMD_TABLE.sendData(DEFAULT_CHANNEL, data.byteLength, timeout);
        const _this = this;
        return new Promise((resolve, reject) => {
            this._sendWithProtocol(cmd, 2, () => {
                _this._sendForResponseSync(data, timeout).then(resp => {
                    if (resp == 'SEND A') {
                        resolve(_this);
                    } else {
                        reject({
                            errMsg: `Inavlidate response[SEND_AFTER]${resp}`
                        })
                    }
                }).catch(reject);
            }, reject, 'B')
        });
    }
}

export default ScaleApi;