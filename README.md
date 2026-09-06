# NØRU × Metricool Bridge

API propia desplegada en Vercel que actúa como intermediaria entre Claude y Metricool, con un gestor de assets (DAM) propio y diseño preparado para publicar en varias redes sociales.

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el contexto completo: por qué existe este proyecto, modelo de dominio, integración con Metricool, diseño de la API y plan de implementación por fases.

La referencia de endpoints para agentes que consumen esta API vive en [public/API.md](./public/API.md), servida en producción en `/API.md` — mantenerla al día es lo que le permite a otro agente de Claude consultarla directamente en vez de que se le pase a mano en cada sesión.

## Desarrollo

```bash
cp .env.local.example .env.local   # rellenar con las credenciales reales
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

## Despliegue

Ver §10 de `ARCHITECTURE.md`.
