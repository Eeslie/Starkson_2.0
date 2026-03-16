module.exports = {
  apps: [
    {
      name: "frontend",
      cwd: "C:/new_Starkson/Starkson_2.0/frontend", // Use forward slashes
      script: "C:/Program Files/nodejs/npm.cmd", // ABSOLUTE PATH to npm.cmd
      args: "run dev",
      interpreter: "", // Remove interpreter
      watch: false,
      windowsHide: true, // Add this for Windows
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      error_file: "C:/new_Starkson/Starkson_2.0/logs/frontend-error.log",
      out_file: "C:/new_Starkson/Starkson_2.0/logs/frontend-out.log"
    },
    {
      name: "backend",
      cwd: "C:/new_Starkson/Starkson_2.0/backend", // Adjust this path
      script: "C:/Program Files/nodejs/npm.cmd", // Same absolute path
      args: "run dev", // Change to your backend start command
      interpreter: "",
      watch: false,
      windowsHide: true,
      env: {
        NODE_ENV: "development",
        PORT: 5000
      },
      error_file: "C:/new_Starkson/Starkson_2.0/logs/backend-error.log",
      out_file: "C:/new_Starkson/Starkson_2.0/logs/backend-out.log"
    }
  ]
};