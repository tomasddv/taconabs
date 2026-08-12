import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { downloadDriveFile, uploadFileToDrive } from "./drive.js";
import { parseVentaDiaria, summarizeVenta } from "./ventaParser.js";
import { buildObjectivePerformance, distributeObjective, loadAuxiliaryRules, loadComboObjective, loadObjectiveWorkbook, objectiveKeyForQuery } from "./objectives.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const upload = multer({ dest: path.join(rootDir, "uploads") });
const app = express();
let objectiveCache = null;
let comboObjectiveCache = undefined;
let auxiliaryRulesCache = null;
let historicalCache = null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, source: "ventadiaria.txt" });
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
    const buffer = await downloadDriveFile(config.ventaDiariaFileId);
    const parsed = parseVentaDiaria(buffer);
    const objective = await getObjective();
    const comboObjective = await getComboObjective();
    const auxiliaryRules = await getAuxiliaryRules();
    const historicalRows = await getHistoricalRows(parsed.rows);
    res.json(
      summarizeVenta(parsed, req.query, {
        distributeObjective: ({ currentRows, query }) =>
          distributeObjective({
            objective,
            objectiveKey: objectiveKeyForQuery(query),
            historicalRows,
            currentRows,
            auxiliaryRules
          }),
        buildObjectivePerformance: ({ rows, dateSet }) => buildObjectivePerformance({ objective, rows, dateSet, auxiliaryRules }),
        comboObjective
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/monthly-focus", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Debe subir un archivo Excel." });
      return;
    }

    const uploaded = await uploadFileToDrive({
      filePath: req.file.path,
      fileName: req.body.month ? `focos-objetivos-${req.body.month}.xlsx` : req.file.originalname,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      folderId: config.driveFolderId
    });

    res.json({
      ok: true,
      driveFile: uploaded,
      summary: {
        originalName: req.file.originalname,
        size: req.file.size,
        month: req.body.month || null
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Error interno" });
});

async function getObjective() {
  if (!objectiveCache) {
    objectiveCache = await loadObjectiveWorkbook({
      localPath: config.objetivoLocalPath,
      driveFileId: config.objetivoFileId,
      rootDir
    });
  }
  return objectiveCache;
}

async function getComboObjective() {
  if (comboObjectiveCache === undefined) {
    comboObjectiveCache = await loadComboObjective({ localPath: config.seguimientoLocalPath });
  }
  return comboObjectiveCache;
}

async function getAuxiliaryRules() {
  if (!auxiliaryRulesCache) {
    auxiliaryRulesCache = await loadAuxiliaryRules({ driveFileId: config.auxiliaresFileId });
  }
  return auxiliaryRulesCache;
}

async function getHistoricalRows(currentRows) {
  if (!historicalCache) {
    const parsedFiles = [];
    for (const fileId of config.historicalVentaFileIds) {
      const buffer = await downloadDriveFile(fileId);
      parsedFiles.push(...parseVentaDiaria(buffer).rows);
    }
    historicalCache = parsedFiles;
  }
  return [...historicalCache, ...(currentRows || [])];
}

app.listen(config.port, () => {
  console.log(`API lista en http://127.0.0.1:${config.port}`);
});
