# Automatizacion del scraper

## Comandos

```bash
npm run sync:tiktok
npm run sync:instagram
node scripts/apify-sync.mjs --platform=tiktok --limit=15
node scripts/apify-sync.mjs --platform=tiktok --campaign=12
```

## Que hace

- Toma los influencers de las campañas activas.
- Consolida perfiles unicos para no scrapear el mismo perfil varias veces.
- Ejecuta una sola corrida en Apify por plataforma.
- Reparte los resultados a cada campaña correspondiente.
- Inserta nuevos `post_metrics` y crea `posts` si aparecen publicaciones nuevas.
- Actualiza seguidores del influencer cuando Apify devuelve un valor mas reciente.

## Variables de entorno

Usa estas variables desde `.env`:

- `VITE_DATABASE_URL` o `DATABASE_URL`
- `VITE_APIFY_TOKEN` o `APIFY_TOKEN`

## Recomendacion con n8n

La opcion mas barata y simple es usar `n8n` solo como scheduler/orquestador:

1. Nodo `Schedule Trigger`.
2. Nodo `Execute Command`.
3. Comando:

```bash
cd F:\CODIGOS\ruido-influencer-mkt && npm run sync:tiktok
```

Opcional para Instagram:

```bash
cd F:\CODIGOS\ruido-influencer-mkt && npm run sync:instagram
```

## Frecuencia sugerida

- TikTok: cada 6 a 12 horas.
- Instagram: 1 vez al dia o menos, porque suele ser mas caro/inestable.

## Notas

- Por defecto solo sincroniza campañas con estado `Activa`.
- Puedes cambiar el filtro con `--status=...`.
- Si quieres probar una campaña puntual, usa `--campaign=<id>`.
