# Dashboard Ventas Diarias

Dashboard para seguimiento de venta diaria desde `ventadiaria.txt`.

## Fuentes

- `ventadiaria.txt`: unica fuente diaria de venta. No se usa `ventadiaria bultos.txt`.
- `OBJETIVO.xlsx`: objetivos mensuales.
- `AUXILIARES.xlsx`: maestro de marcas, segmentos, calibres y familias.
- Excel mensual de focos/objetivos: se carga desde la pantalla de administracion y se guarda en Drive.

## Ejecutar localmente

```bash
npm install
copy .env.example .env
npm run dev
```

Frontend: `http://127.0.0.1:5173`

Backend: `http://127.0.0.1:4100`

## Drive

Para subir archivos a Drive desde el backend, configure una cuenta de servicio con acceso a la carpeta compartida y agregue una de estas variables:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

La carpeta destino se define con `GOOGLE_DRIVE_FOLDER_ID`.

## GitHub

El proyecto esta listo para publicarse en GitHub. Si el repositorio ya existe:

```bash
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```
