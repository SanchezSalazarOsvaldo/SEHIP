-- valores de prueba de Cp, Ci e intensidades para poder usar el sistema; Milpa Alta a 50 años se deja sin capturar para probar ese error.
-- los valores reales los aporta el equipo y no deben mezclarse con la estructura.
-- =====================================================================
-- SEHIP - Datos de prueba de la tabla maestra normativa (PostgreSQL / Supabase)
-- Se ejecuta después de sehip_base_de_datos.sql.
-- Los valores son ilustrativos para probar el sistema de extremo a extremo;
-- se sustituyen por los valores normativos oficiales mediante RF-ADM-03.
-- =====================================================================

-- Coeficientes de escurrimiento: Cp (superficie permeable) y Ci (superficie impermeable).
INSERT INTO coeficiente_normativo (tipo, valor) VALUES ('Cp', 0.20), ('Ci', 0.90);

-- Intensidad de lluvia (mm/h) por período de retorno, igual para las 16 alcaldías. Milpa Alta a 50 años
-- se deja sin capturar a propósito, para probar el flujo alterno 2 de RF-WEB-05.
INSERT INTO intensidad_lluvia (id_alcaldia, periodo_retorno, intensidad_mm_h)
SELECT a.id_alcaldia, p.periodo, p.intensidad
  FROM alcaldia a
 CROSS JOIN (VALUES (2, 40.00), (5, 55.00), (10, 65.00), (20, 75.00), (50, 90.00)) AS p (periodo, intensidad)
 WHERE NOT (a.nombre = 'Milpa Alta' AND p.periodo = 50);

-- Incidencias oficiales de prueba (puntos críticos de encharcamiento) para los mapas del panel de control
-- (RF-ADM-02) y de la aplicación móvil (RF-MOV-05). Los ciudadanos agregan más desde la app; quedan
-- pendientes hasta que un administrador los aprueba.
INSERT INTO punto_critico (id_alcaldia, latitud, longitud, fecha_registro, id_tipo_incidencia)
SELECT a.id_alcaldia, p.latitud, p.longitud, p.fecha,
       (SELECT id_tipo_incidencia FROM tipo_incidencia WHERE nombre = 'Encharcamiento')
  FROM (VALUES
    ('Iztacalco',           19.411600, -99.062400, TIMESTAMP '2026-06-14 18:20:00'),
    ('Benito Juárez',       19.403200, -99.156900, TIMESTAMP '2026-06-21 19:05:00'),
    ('Iztapalapa',          19.359200, -99.104700, TIMESTAMP '2026-07-02 17:45:00'),
    ('Coyoacán',            19.343600, -99.140600, TIMESTAMP '2026-07-09 20:10:00'),
    ('Gustavo A. Madero',   19.498700, -99.120500, TIMESTAMP '2026-07-15 16:30:00'),
    ('Venustiano Carranza', 19.441700, -99.090100, TIMESTAMP '2026-07-22 18:55:00'),
    ('Tlalpan',             19.302000, -99.189000, TIMESTAMP '2026-08-03 19:40:00'),
    ('Tláhuac',             19.296000, -99.061000, TIMESTAMP '2026-08-11 17:15:00'),
    ('Iztapalapa',          19.387000, -99.054000, TIMESTAMP '2026-08-19 21:00:00'),
    ('Miguel Hidalgo',      19.459000, -99.188000, TIMESTAMP '2026-08-27 18:05:00'),
    ('Iztapalapa',          19.374000, -99.081000, TIMESTAMP '2026-09-04 19:25:00'),
    ('Xochimilco',          19.260000, -99.105000, TIMESTAMP '2026-09-12 16:50:00')
  ) AS p (alcaldia, latitud, longitud, fecha)
  JOIN alcaldia a ON a.nombre = p.alcaldia;
