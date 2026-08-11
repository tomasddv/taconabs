import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4100),
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "1cukgXLUaPsEDK_yD7tSwgaBFZAbiDUot",
  ventaDiariaFileId: process.env.VENTADIARIA_FILE_ID || "12c7hy-bTbg7P_1QYUyKKcooNLo4iog1x",
  objetivoFileId: process.env.OBJETIVO_FILE_ID || "1qw127SPBgHR9Spi-0SA8TKLRBhpJ_Xg7",
  auxiliaresFileId: process.env.AUXILIARES_FILE_ID || "1zXhbWtT7K1tY43MmYz7oTTYifMgmLyFT"
};
