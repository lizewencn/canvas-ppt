import { message } from "ant-design-vue";
import fs from "fs";

window.electron = {
    exit: () => {
        console.log("xxxx exit");
    },
    readFile: (path: string) => {
        message.info(`preload,readFile:${path}`,)
        const buffer = fs.readFileSync(path);
        const arraybuffer = new Uint8Array(buffer).buffer;
        return new File([arraybuffer], "fileName.zip");
    },
    saveFile: (path: string, buffer: Buffer) => {
        const isExist = fs.existsSync(path);
        if (isExist) {
            fs.writeFileSync(path, buffer);
            return true;
        } else {
            return false;
        }
    }
}
