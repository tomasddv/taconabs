import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4100),
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "1cukgXLUaPsEDK_yD7tSwgaBFZAbiDUot",
  ventaDiariaFileId: process.env.VENTADIARIA_FILE_ID || "12c7hy-bTbg7P_1QYUyKKcooNLo4iog1x",
  objetivoFileId: process.env.OBJETIVO_FILE_ID || "1qw127SPBgHR9Spi-0SA8TKLRBhpJ_Xg7",
  objetivoLocalPath: process.env.OBJETIVO_LOCAL_PATH || "uploads/objetivos-agosto-202608.xlsx",
  seguimientoLocalPath: process.env.SEGUIMIENTO_LOCAL_PATH || "C:/Users/triesgo/Downloads/SEGUIMIENTO AGOSTO!.xlsx",
  comboObjectiveFallback: Number(process.env.COMBO_OBJECTIVE || 170),
  historicalVentaFileIds: (process.env.HISTORICAL_VENTA_FILE_IDS || "1t3Qck9PMkvq4qp6XNynVUAGV1REP8NqD,1nMCKcAXe7n_ROsJtbtgSuqik5pR4VdCW")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  auxiliaresFileId: process.env.AUXILIARES_FILE_ID || "1zXhbWtT7K1tY43MmYz7oTTYifMgmLyFT"
};
