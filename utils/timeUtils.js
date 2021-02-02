export const sleep = ms => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};
export const sleepSync = async ms => {
    await sleep(ms);
};