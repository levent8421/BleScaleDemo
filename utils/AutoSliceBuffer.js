class AutoSliceBuffer {
    constructor(props) {
        const {
            sliceSize
        } = props;
        this.sliceSize = sliceSize || 20;
        this.buffer = [];
    }
    pushData(data) {
        let windowStart = 0;
        let windowEnd = Math.min(this.sliceSize, data.byteLength);
        while (windowEnd < data.byteLength) {
            const slice = data.slice(windowStart, windowEnd);
            this.buffer.push(slice);
            windowStart = windowEnd;
            windowEnd += this.sliceSize;
            if (windowEnd > data.byteLength) {
                windowEnd = data.byteLength;
            }
        }
        const lastSlice = data.slice(windowStart, windowEnd);
        this.buffer.push(lastSlice);
    }
    isEmpty() {
        return this.buffer.length <= 0;
    }
    getSlice() {
        return this.buffer.shift();
    }
}
export default AutoSliceBuffer;