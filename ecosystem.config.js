module.exports = {
  apps: [
    {
      name: "wac_site_dash",
      script: "npm run start",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",

      // Variables de entorno
      env: {
        NODE_ENV: "production",
        PORT: 4004, // Puerto de producción
        HOST: "0.0.0.0",
      },

      // Configuración de logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/error.log",
      out_file: "logs/out.log",

      // Control de procesos
      min_uptime: "30s",
      max_restarts: 5,
      restart_delay: 3000,
    },
  ],
};
