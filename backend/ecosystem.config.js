import "dotenv/config" 

export const apps = [{
    script: "index.ts",
    instances: "max",
    exec_mode: "cluster",
}];