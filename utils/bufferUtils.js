export const stringToArrayBuffer = str => {
    const buf = new ArrayBuffer(str.length);
    const dv = new Uint8Array(buf);
    let index = 0;
    for (const c of str) {
        const byte = c.charCodeAt();
        dv[index++] = byte;
    }
    return buf;
};