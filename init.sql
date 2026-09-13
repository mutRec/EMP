-- ============================================================
-- Escola de Música del Palau — Esquema de base de dades
-- ============================================================

-- Nivells possibles dels cursos (mantenim com a text controlat des del backend)
-- 'sensibilitzacio' | 'iniciacio' | 'elemental' | 'professional' | 'adults'

CREATE TABLE IF NOT EXISTS cursos (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    nivell VARCHAR(30) NOT NULL DEFAULT 'iniciacio',
    descripcio TEXT,
    preu DECIMAL(10, 2) NOT NULL,
    edat_min INT,
    edat_max INT,
    horari VARCHAR(150),
    places_totals INT NOT NULL,
    places_disponibles INT NOT NULL,
    actiu BOOLEAN NOT NULL DEFAULT true,
    creat_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alumnes (
    id SERIAL PRIMARY KEY,
    nom_complet VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefon VARCHAR(20),
    data_naixement DATE,
    data_registre TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matricules (
    id SERIAL PRIMARY KEY,
    alumne_id INT REFERENCES alumnes(id) ON DELETE CASCADE,
    curs_id INT REFERENCES cursos(id) ON DELETE RESTRICT,
    curs_academic VARCHAR(9) NOT NULL DEFAULT '2026-2027',
    data_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estat VARCHAR(20) NOT NULL DEFAULT 'pendent'
        CHECK (estat IN ('pendent', 'confirmada', 'cancel·lada')),
    comentaris TEXT,
    UNIQUE(alumne_id, curs_id, curs_academic)
);

-- Usuaris administradors del panell de gestió
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    creat_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matricules_estat ON matricules(estat);
CREATE INDEX IF NOT EXISTS idx_matricules_curs ON matricules(curs_id);
CREATE INDEX IF NOT EXISTS idx_cursos_nivell ON cursos(nivell);

-- ============================================================
-- Dades de prova inicials
-- ============================================================

INSERT INTO cursos (nom, nivell, descripcio, preu, edat_min, edat_max, horari, places_totals, places_disponibles) VALUES
('Uni Dori Teri (música i família)', 'sensibilitzacio', 'Primer contacte amb la música a través del joc, el moviment i el cant, acompanyats per la família.', 95.00, 0, 3, 'Dimarts 10:00 - 10:45', 12, 12),
('Iniciació Musical', 'iniciacio', 'Llenguatge musical, cant i moviment per descobrir la música de forma lúdica.', 110.00, 4, 7, 'Dilluns i dijous 17:00 - 18:00', 16, 16),
('Piano Elemental', 'elemental', 'Tècnica pianística i llenguatge musical per a alumnes que comencen l’itinerari instrumental.', 150.00, 8, 12, 'Dimecres 17:30 - 18:15', 10, 10),
('Guitarra Clàssica Elemental', 'elemental', 'Iniciació a la tècnica de guitarra clàssica i repertori progressiu.', 145.00, 8, 12, 'Divendres 17:00 - 17:45', 12, 12),
('Coral Infantil', 'elemental', 'Cant coral, educació de la veu i treball d’oïda en grup.', 90.00, 6, 12, 'Dimarts 18:00 - 19:00', 20, 20),
('Violí Professional', 'professional', 'Preparació tècnica i interpretativa orientada a l’accés a estudis professionals.', 210.00, 12, 18, 'Dijous 18:00 - 19:00', 8, 8),
('Combo i Música Moderna', 'professional', 'Treball de conjunt instrumental, improvisació i repertori modern.', 180.00, 13, 18, 'Divendres 18:00 - 19:30', 10, 10),
('Piano per a Adults', 'adults', 'Aprenentatge adaptat al ritme i als interessos de cada alumne/a adult.', 160.00, 18, 99, 'Dimecres 19:00 - 19:45', 10, 10),
('Guitarra per a Adults', 'adults', 'Tècnica i repertori de guitarra adaptats a alumnat adult, amb o sense experiència prèvia.', 150.00, 18, 99, 'Dilluns 19:00 - 19:45', 10, 10);

-- Usuari administrador per defecte
-- Usuari: admin
-- Contrasenya: Palau2026!
-- ⚠️ IMPORTANT: canvia aquesta contrasenya després del primer accés (vegeu README).
INSERT INTO admins (username, password_hash) VALUES
('admin', '$2b$10$bDLUpZYG0aX1w5oDyjOVYeMMz/9hpqBjRg8lKbX6vEjTdgURNM53y')
ON CONFLICT (username) DO NOTHING;
