Dashboard Operativo Aquaservice — GitHub Pages
Este paquete contiene una web sencilla y profesional para ver KPIs, semáforos, gráficos y tablas de control.
Archivos incluidos
`index.html`: página principal.
`styles.css`: diseño visual.
`app.js`: lógica del dashboard, semáforos, filtros y gráficos.
`data.json`: datos extraídos de los Excel enviados.
Cómo publicarlo gratis en GitHub Pages
Crear un repositorio en GitHub.
Subir estos 4 archivos a la raíz del repositorio.
Entrar en `Settings > Pages`.
En `Build and deployment`, elegir `Deploy from a branch`.
Seleccionar rama `main` y carpeta `/root`.
Guardar.
GitHub dará un enlace web para compartir con los jefes de equipo.
Cómo hacer que se actualice cuando cambies datos
Opción 1, sencilla:
Cada vez que cambies el Excel, se actualiza `data.json` y se sube de nuevo a GitHub.
GitHub Pages se actualiza gratis.
Opción 2, recomendada para que sea más automático:
Pasar los datos a Google Sheets.
Publicar las pestañas como CSV.
Cambiar `app.js` para leer esas URLs en vez de `data.json`.
Así los jefes de equipo ven datos nuevos al refrescar la página.
Semáforos usados
Incidencias: verde <= 1,5%, amarillo <= 2,5%, rojo > 2,5%.
Nodel: verde <= 3%, amarillo <= 5%, rojo > 5%.
Higienes: verde <= 1%, amarillo <= 1,5%, rojo > 1,5%.
Café: verde >= 90%, amarillo >= 80%, rojo < 80%.
Avisos +48h: verde 0%, amarillo <= 5%, rojo > 5%.
Estos límites se pueden cambiar en `app.js`.
