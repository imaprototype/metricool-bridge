# NØRU × Metricool Bridge

API propia desplegada en Vercel que actúa como intermediaria entre Claude y Metricool, con un gestor de assets (DAM) propio y diseño preparado para publicar en varias redes sociales.

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el contexto completo: por qué existe este proyecto, modelo de dominio, integración con Metricool, diseño de la API y plan de implementación por fases.

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
