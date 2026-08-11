import fs from "node:fs";
import { google } from "googleapis";

export function buildDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export async function downloadDriveFile(fileId) {
  const response = await fetch(buildDownloadUrl(fileId));
  if (!response.ok) {
    throw new Error(`No se pudo descargar Drive file ${fileId}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  return undefined;
}

export async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/drive.file"]
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadFileToDrive({ filePath, fileName, mimeType, folderId }) {
  const drive = await getDriveClient();
  const result = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath)
    },
    fields: "id,name,webViewLink,createdTime,modifiedTime"
  });
  return result.data;
}
