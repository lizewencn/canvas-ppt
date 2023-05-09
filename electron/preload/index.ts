import fs from "fs";

window.electron = {
    exit: () => {
        console.log("xxxx exit");
    },
    readFile: (path: string) => {
        const content = fs.readFileSync(path, {
            encoding: "utf-8"
        });
        return content;
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
