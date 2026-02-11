module.exports = {
    apps: [
        {
            name: "newton-api",
            script: "pnpm",
            args: "start",
            instances: 2,
            instance_var: "NEWTON",
            exec_mode: "cluster",
            listen_timeout: 10000,
            restart_delay: 10000,
            cwd: "."
        }
    ]
}