import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { downloadDriveFile, uploadFileToDrive } from "./drive.js";
import { parseVentaDiaria, summarizeVenta } from "./ventaParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const upload = multer({ dest: path.join(rootDir, "uploads") });
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, source: "ventadiaria.txt" });
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
    const buffer = await downloadDriveFile(config.ventaDiariaFileId);
    const parsed = parseVentaDiaria(buffer);
    res.json(summarizeVenta(parsed, req.query));
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

app.listen(config.port, () => {
  console.log(`API lista en http://127.0.0.1:${config.port}`);
});
