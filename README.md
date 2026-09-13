# 🎵 Escola de Música del Palau — Matrícules Curs 2026-2027

Web completa per gestionar les matrícules del curs 2026-2027: formulari públic
de matrícula + panell d'administració amb autenticació per gestionar-les.

## Estructura del projecte

```
emp/
├── docker-compose.yml       # Orquestra els 3 serveis (db, backend, frontend)
├── init.sql                 # Esquema de BD + dades de prova + usuari admin per defecte
├── .env                     # Variables d'entorn (BD, JWT, CORS)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js               # Punt d'entrada, wiring de rutes
│       ├── db.js                  # Connexió a PostgreSQL
│       ├── middleware/auth.js     # Middleware d'autenticació (JWT en cookie httpOnly)
│       └── routes/
│           ├── cursos.routes.js       # GET /api/cursos (públic)
│           ├── matricules.routes.js   # POST /api/matricules (públic)
│           ├── auth.routes.js         # /api/auth/login|logout|me
│           └── admin.routes.js        # /api/admin/... (protegit, requereix sessió)
└── frontend/public/
    ├── index.html            # Web pública amb el formulari de matrícula
    ├── script.js
    ├── admin.html             # Login + panell d'administració
    ├── admin.js
    └── styles.css
```

## Posada en marxa

```bash
docker compose up --build
```

- **Web pública:** http://localhost:8080
- **Panell d'administració:** http://localhost:8080/admin.html
- **API:** http://localhost:3000/api

## Accés d'administrador per defecte

| Usuari | Contrasenya |
|--------|-------------|
| `admin` | `Palau2026!` |

⚠️ **Molt important:** aquestes credencials són només per a la primera posada en
marxa. Canvia-les abans de posar el projecte en producció (vegeu més avall).

## Com funciona l'autenticació

- El login (`POST /api/auth/login`) verifica l'usuari contra la taula `admins`
  (contrasenyes desades amb `bcrypt`, mai en text pla) i, si és correcte, envia
  un JWT dins una **cookie httpOnly** (`emp_token`), no accessible des de
  JavaScript al navegador — així es redueix el risc de robatori de sessió via XSS.
- Totes les rutes `/api/admin/*` passen pel middleware `requireAuth`, que
  verifica el JWT abans de deixar continuar la petició.
- El login té un límit de 10 intents cada 15 minuts per IP (`express-rate-limit`)
  per mitigar atacs de força bruta.
- `admin.html` comprova la sessió (`GET /api/auth/me`) en carregar la pàgina i
  mostra el formulari de login o el panell segons correspongui.

## Com canviar la contrasenya d'administrador

Genera un nou hash i actualitza'l directament a la base de dades:

```bash
docker compose exec backend node -e "console.log(require('bcryptjs').hashSync('LaTevaNovaContrasenya', 10))"
docker compose exec db psql -U postgres -c "UPDATE admins SET password_hash = '<hash generat>' WHERE username = 'admin';"
```

O bé crea un nou usuari administrador:

```sql
INSERT INTO admins (username, password_hash) VALUES ('nom_usuari', '<hash generat>');
```

## Què pot fer l'administrador des del panell

- **Resum:** totals de matrícules, pendents/confirmades/cancel·lades, ingressos
  estimats i places lliures.
- **Matrícules:** llistat filtrable per estat, curs o cerca (nom/email),
  canviar l'estat d'una matrícula (pendent → confirmada → cancel·lada) i
  eliminar-la. Les places del curs es reajusten automàticament.
- **Cursos:** crear, editar, activar/desactivar i eliminar cursos (nivell,
  preu, places, edat, horari). Els cursos inactius o sense places deixen
  d'aparèixer al formulari públic.

## Abans de desplegar a producció

1. Canvia `JWT_SECRET` a `.env` per un valor nou i secret.
2. Canvia la contrasenya de PostgreSQL (`DB_PASSWORD`) i la de l'admin per defecte.
3. Posa `NODE_ENV=production` (activa la flag `secure` de la cookie, que
   requereix HTTPS).
4. Serveix el frontend i el backend sota el mateix domini (p. ex. amb un
   proxy invers com nginx o Traefik) i actualitza `CORS_ORIGIN` en
   conseqüència.
5. Substitueix les dades de contacte de la pàgina (adreça, telèfon, correu)
   per les reals de l'escola.

## Notes

- Les dades de contacte, adreça, telèfon i dates de calendari de
  `index.html` són **contingut d'exemple**: edita'ls amb la informació real
  de l'escola abans de publicar.
- `node_modules` no s'inclou al projecte: `docker compose up --build` les
  instal·la automàticament dins del contenidor.
