import express from "express";
import cors from "cors";
import { exec } from "child_process";
import fs from "fs";
import { v4 as uuid } from "uuid";
import path from "path";
import crypto from "crypto";

const app = express();
const PORT = process.env.FUNCTIONS_HTTPWORKER_PORT || process.env.PORT || 3000;


// Enable CORS for all origins with full support for methods and headers
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve frontend dashboard correctly
app.use(express.static("public"));

// Concurrency Queue to prevent resource exhaustion on small containers
let activeExecutions = 0;
const MAX_CONCURRENT = 1; // Strict limit: 1 execution at a time for very weak containers
const queue = [];

const processQueue = async () => {
  if (activeExecutions >= MAX_CONCURRENT || queue.length === 0) return;
  
  const { task, resolve, reject } = queue.shift();
  activeExecutions++;
  
  try {
    const result = await task();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    activeExecutions--;
    processQueue();
  }
};

const runQueued = (task) => {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    processQueue();
  });
};

const ensureTempDir = () => {
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }
  if (!fs.existsSync('cache')) {
    fs.mkdirSync('cache', { recursive: true });
  }
};

const getCacheKey = (language, code) => {
  return crypto.createHash('md5').update(`${language}:${code}`).digest('hex');
};

const runCode = (language, code, input, id) => {
  // Language number mapping
  const LANGUAGE_MAP = {
    1: "c",
    2: "cpp", 
    3: "java",
    4: "python",
    5: "javascript",
    6: "typescript",
    7: "sql"
  };

  // Convert number to language string
  const languageStr = LANGUAGE_MAP[language] || language;
  
  const dir = `temp/${id}`;
  fs.mkdirSync(dir, { recursive: true });

  let file, cmd;

  try {
    switch (languageStr) {
      case "python":
        file = `${dir}/main.py`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && python3 main.py < input.txt`;
        } else {
          cmd = `cd ${dir} && python3 main.py`;
        }
        break;

      case "c":
        file = `${dir}/main.c`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && gcc main.c -o main && ./main < input.txt`;
        } else {
          cmd = `cd ${dir} && gcc main.c -o main && ./main`;
        }
        break;

      case "cpp":
        file = `${dir}/main.cpp`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && g++ main.cpp -o main && ./main < input.txt`;
        } else {
          cmd = `cd ${dir} && g++ main.cpp -o main && ./main`;
        }
        break;

      case "java":
        file = `${dir}/Main.java`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && javac Main.java && java Main < input.txt`;
        } else {
          cmd = `cd ${dir} && javac Main.java && java Main`;
        }
        break;

      case "javascript":
      case "js":
        file = `${dir}/main.js`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && node main.js < input.txt`;
        } else {
          cmd = `cd ${dir} && node main.js`;
        }
        break;

      case "typescript":
      case "ts":
        file = `${dir}/main.ts`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && ts-node main.ts < input.txt`;
        } else {
          cmd = `cd ${dir} && ts-node main.ts`;
        }
        break;

      case "sql":
      case "sqlite":
        file = `${dir}/main.sql`;
        // For SQL, we need to handle the input differently
        let sqlCode = `.headers on\n.mode json\n${code}`;
        if (input) {
          // If input is provided, treat it as additional SQL commands
          sqlCode = `${sqlCode}\n${input}`;
        }
        fs.writeFileSync(file, sqlCode);
        cmd = `cd ${dir} && sqlite3 main.db < main.sql`;
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    const runCommand = (cmd, timeoutMs = 15000) => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        exec(cmd, { 
          timeout: timeoutMs,
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }, (error, stdout, stderr) => {
          const executionTime = Date.now() - startTime;
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            error: error,
            executionTime,
            timeout: error ? (Boolean(error.killed) || executionTime >= timeoutMs) : false
          });
        });
      });
    };

    const execute = async () => {
      let compileResult = { executionTime: 0, isFromCache: false };
      let runResult = { stdout: "", stderr: "", executionTime: 0, timeout: false, error: null };

      // Cache Management
      const cacheKey = getCacheKey(languageStr, code);
      const cacheDir = `cache/${cacheKey}`;
      const hasCache = fs.existsSync(cacheDir);

      // Compilation Step (with caching)
      if (["c", "cpp", "java", "typescript", "ts"].includes(languageStr)) {
        if (hasCache) {
          // Copy cached files to temp dir
          const cachedFiles = fs.readdirSync(cacheDir);
          cachedFiles.forEach(file => {
            fs.copyFileSync(path.join(cacheDir, file), path.join(dir, file));
          });
          compileResult.isFromCache = true;
          console.log(`   - Cache Hit: ${cacheKey}`);
        } else {
          let compileCmd;
          switch (languageStr) {
            case "c": compileCmd = `cd ${dir} && gcc main.c -o main`; break;
            case "cpp": compileCmd = `cd ${dir} && g++ main.cpp -o main`; break;
            case "java": compileCmd = `cd ${dir} && javac Main.java`; break;
            case "typescript":
            case "ts": compileCmd = `cd ${dir} && tsc main.ts --esModuleInterop --skipLibCheck`; break;
          }
          
          if (compileCmd) {
            compileResult = await runCommand(compileCmd, 30000); // 30s for compilation
            if (compileResult.error) {
              return {
                output: compileResult.stdout,
                error: `Compilation Error: ${compileResult.stderr || compileResult.error.message}`,
                exitCode: 1,
                cpuTime: compileResult.executionTime,
                memory: 2048,
                timeout: compileResult.timeout,
                signal: compileResult.error.signal,
                compileTime: compileResult.executionTime
              };
            }
            
            // On success, save to cache
            fs.mkdirSync(cacheDir, { recursive: true });
            const outputFiles = {
              "c": ["main"],
              "cpp": ["main"],
              "java": ["Main.class"], // Could be multiple, but Main is standard
              "typescript": ["main.js"],
              "ts": ["main.js"]
            }[languageStr] || [];
            
            // For Java, it might generate anonymous classes (Main$1.class), so we catch all .class
            if (languageStr === "java") {
              const files = fs.readdirSync(dir).filter(f => f.endsWith('.class'));
              files.forEach(f => fs.copyFileSync(path.join(dir, f), path.join(cacheDir, f)));
            } else {
              outputFiles.forEach(f => {
                if (fs.existsSync(path.join(dir, f))) {
                  fs.copyFileSync(path.join(dir, f), path.join(cacheDir, f));
                }
              });
            }
          }
        }
      }

      // Execution Step
      let executionCmd;
      switch (languageStr) {
        case "python": executionCmd = `cd ${dir} && python3 main.py ${input ? "< input.txt" : ""}`; break;
        case "c":
        case "cpp": executionCmd = `cd ${dir} && ./main ${input ? "< input.txt" : ""}`; break;
        case "java": executionCmd = `cd ${dir} && java Main ${input ? "< input.txt" : ""}`; break;
        case "javascript":
        case "js": executionCmd = `cd ${dir} && node main.js ${input ? "< input.txt" : ""}`; break;
        case "typescript":
        case "ts": 
          // If we compiled to main.js, we can run it with node instead of ts-node (MUCH faster)
          if (fs.existsSync(`${dir}/main.js`)) {
            executionCmd = `cd ${dir} && node main.js ${input ? "< input.txt" : ""}`;
          } else {
            executionCmd = `cd ${dir} && ts-node main.ts ${input ? "< input.txt" : ""}`; 
          }
          break;
        case "sql":
        case "sqlite": executionCmd = `cd ${dir} && sqlite3 main.db < main.sql`; break;
      }

      runResult = await runCommand(executionCmd, 10000); // 10s for execution

      // Clean up temp
      try {
        if (fs.rmSync) fs.rmSync(dir, { recursive: true, force: true });
        else fs.rmdirSync(dir, { recursive: true });
      } catch (e) { console.error('Cleanup error:', e); }

      const errStr = runResult.stderr || (runResult.error && runResult.error.message) || "";
      let errorMsg = null;
      if (runResult.error || errStr) {
        errorMsg = errStr.trim();
        if (errorMsg === "") errorMsg = "Execution Error";
      }

      return {
        output: runResult.stdout,
        error: errorMsg,
        exitCode: runResult.error ? 1 : 0,
        cpuTime: runResult.executionTime,
        memory: 2048,
        timeout: runResult.timeout,
        signal: runResult.error ? runResult.error.signal : null,
        compileTime: compileResult.isFromCache ? 0 : (compileResult.executionTime || null)
      };
    };

    return execute();
  } catch (error) {
    // Clean up on error
    try {
      if (fs.rmSync) {
        fs.rmSync(dir, { recursive: true, force: true });
      } else {
        fs.rmdirSync(dir, { recursive: true });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    throw error;
  }
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Get supported languages
app.get("/languages", (req, res) => {
  res.json({
    languages: [
      { name: "c", extension: "c", number: 1 },
      { name: "cpp", extension: "cpp", number: 2 },
      { name: "java", extension: "java", number: 3 },
      { name: "python", extension: "py", number: 4 },
      { name: "javascript", extension: "js", number: 5 },
      { name: "js", extension: "js", number: 5 },
      { name: "typescript", extension: "ts", number: 6 },
      { name: "ts", extension: "ts", number: 6 },
      { name: "sql", extension: "sql", number: 7 },
      { name: "sqlite", extension: "sql", number: 7 }
    ]
  });
});

// Main code execution endpoint
app.post("/run", async (req, res) => {
  try {
    ensureTempDir();
    
    const { language, sourceCode, input } = req.body;

    // Validate inputs
    if (!language) {
      return res.status(400).json({ error: "Language is required" });
    }
    
    if (!sourceCode || sourceCode.trim() === "") {
      return res.status(400).json({ error: "Source code cannot be empty" });
    }

    const id = uuid();
    
    // Convert language number to string for logging
    const LANGUAGE_MAP = {
      1: "c",
      2: "cpp", 
      3: "java",
      4: "python",
      5: "javascript",
      6: "typescript",
      7: "sql"
    };
    
    const languageStr = LANGUAGE_MAP[language] || language;
    console.log(`Executing ${languageStr} code (number: ${language}) with ID: ${id}`);

    console.log(`   - Input: ${input}`);
    console.log(`   - Source Code: ${sourceCode}`);
    console.log(`   - Language: ${languageStr}`);
    
    // Wrap runCode in the concurrency queue
    const result = await runQueued(() => runCode(language, sourceCode, input || "", id));

    console.log(`   - Output: ${result.output}`);
    console.log(`   - Error: ${result.error}`);
    console.log(`   - Exit Code: ${result.exitCode}`);
    console.log(`   - CPU Time: ${result.cpuTime}`);
    console.log(`   - Memory: ${result.memory}`);
    console.log(`   - Timeout: ${result.timeout}`);
    console.log(`   - Signal: ${result.signal}`);
    console.log(`   - Compile Time: ${result.compileTime}`);
    
    res.json(result);
  } catch (err) {
    console.error("Execution error:", err);
    res.status(500).json({ 
      output: "",
      error: err.message,
      exitCode: 1,
      cpuTime: 0,
      memory: 0,
      timeout: false,
      signal: null,
      compileTime: null
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Code Runner Server running on port ${PORT}`);
  console.log(`📝 Supported languages: C(1), C++(2), Java(3), Python(4), JavaScript(5), TypeScript(6), SQL(7)`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for all origins (Public API Mode)`);
});
