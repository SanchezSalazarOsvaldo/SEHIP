-- una migración cambia la base que ya está en uso sin perder datos y va dentro de BEGIN ... COMMIT: si algo falla no se aplica nada.
-- Si se borrara la base y se creara de nuevo, se perderían cuentas, proyectos y reportes.
-- =====================================================================
-- SEHIP · Migración a la base con solo datos esenciales 
-- Se ejecuta UNA sola vez en el SQL Editor de Supabase, después de migracion_normalizacion.sql 
-- Conserva las cuentas, proyectos, simulaciones, reportes e incidencias. Va dentro de una transacción: (una transaccion es un bloque de instrucciones que se ejecutan como una sola unidad; si algo falla, no se aplica ningún cambio).
-- si algo falla, no se aplica ningún cambio.
--
-- Qué cambia:
--   1. Nueva tabla administrador_inicial; usuario pierde la columna protegido.
--   2. usuario pierde los datos del código de recuperación (ahora viven en la sesión) y fecha_creacion.
--   3. La tabla maestra deja de tener filas con NULL y pierde fecha_actualizacion (no se usaba).
--   4. proyecto_ingeniero pierde fecha_union (no se usaba).
--   5. reporte_pdf pierde nombre_archivo y tamano_bytes (se calculan al consultar).
-- =====================================================================
BEGIN;

-- 1. Administrador inicial en su propia tabla -----------------------------
DROP TRIGGER IF EXISTS trg_usuario_antes_insertar ON usuario; -- Estos triggers ya no son necesarios porque la protección del administrador inicial se maneja en la tabla administrador_inicial.
DROP TRIGGER IF EXISTS trg_usuario_antes_actualizar ON usuario;
DROP TRIGGER IF EXISTS trg_usuario_antes_eliminar ON usuario;
DROP FUNCTION IF EXISTS fn_proteger_administrador_inicial();

CREATE TABLE administrador_inicial (
    id_usuario  INTEGER  PRIMARY KEY,
    CONSTRAINT fk_admin_inicial_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);
CREATE UNIQUE INDEX uq_un_administrador_inicial ON administrador_inicial ((TRUE));
INSERT INTO administrador_inicial (id_usuario) SELECT id_usuario FROM usuario WHERE protegido;

CREATE FUNCTION fn_proteger_administrador_inicial() RETURNS TRIGGER -- Creamos una función para poner en acción al trigger creado
LANGUAGE plpgsql AS $$ -- Lenguaje para indicar que ejecutaras código en el lenguaje interno de PostgreSQL, en este caso PL/pgSQL.
BEGIN 
    IF EXISTS (SELECT 1 FROM administrador_inicial WHERE id_usuario = OLD.id_usuario) THEN -- Valida que la fila que se está actualizando es la del administrador inicial.
    -- No se puede deshabilitar ni cambiar de rol al administrador inicial; si se intenta, se lanza una excepción.
        IF NOT NEW.activo THEN
            RAISE EXCEPTION 'El administrador inicial no puede deshabilitarse.';
        END IF;
        IF NEW.id_rol <> OLD.id_rol THEN
            RAISE EXCEPTION 'El administrador inicial no puede cambiar de rol.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_usuario_antes_actualizar BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_proteger_administrador_inicial();

CREATE FUNCTION fn_administrador_inicial_fijo() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM usuario u JOIN rol r ON r.id_rol = u.id_rol -- Valida que la cuenta que se está insertando como administrador inicial sea una cuenta activa de administrador.
        -- Si ya existe un administrador inicial, no se puede insertar otro.
        -- Si se intenta cambiar o eliminar el administrador inicial, se lanza una excepción.
                        WHERE u.id_usuario = NEW.id_usuario AND u.activo
                          AND r.nombre = 'Administrador del Sistema') THEN
            RAISE EXCEPTION 'El administrador inicial debe ser una cuenta activa de administrador.';
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se puede quitar ni cambiar la protección del administrador inicial.';
END;
$$;
CREATE TRIGGER trg_admin_inicial_insertar BEFORE INSERT ON administrador_inicial
    FOR EACH ROW EXECUTE FUNCTION fn_administrador_inicial_fijo();
CREATE TRIGGER trg_admin_inicial_cambiar BEFORE UPDATE OR DELETE ON administrador_inicial
    FOR EACH ROW EXECUTE FUNCTION fn_administrador_inicial_fijo();
ALTER TABLE administrador_inicial ENABLE ROW LEVEL SECURITY;

-- 2. usuario: solo los datos de la cuenta ------------------------------------
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS ck_usuario_intentos;
ALTER TABLE usuario
    DROP COLUMN protegido,
    DROP COLUMN codigo_recuperacion_hash,
    DROP COLUMN codigo_expira,
    DROP COLUMN intentos_codigo,
    DROP COLUMN fecha_creacion;

-- 3. Tabla maestra sin filas vacías ------------------------------------------
DELETE FROM coeficiente_normativo WHERE valor IS NULL;
ALTER TABLE coeficiente_normativo DROP CONSTRAINT ck_coeficiente_valor;
ALTER TABLE coeficiente_normativo
    DROP COLUMN fecha_actualizacion,
    ALTER COLUMN valor SET NOT NULL,
    ADD CONSTRAINT ck_coeficiente_valor CHECK (valor BETWEEN 0.05 AND 0.95);

-- Un proyecto que apuntara a una intensidad sin capturar vuelve a quedar sin período de retorno.
UPDATE proyecto p
   SET periodo_retorno = NULL, estado = 'En proceso'
  FROM intensidad_lluvia i
 WHERE i.id_alcaldia = p.id_alcaldia AND i.periodo_retorno = p.periodo_retorno -- Esto valida que el proyecto esté apuntando a una intensidad que ya no existe en la tabla maestra.
 -- Si la intensidad de lluvia ya no existe, el proyecto queda en estado "En proceso" y sin período de retorno.
   AND i.intensidad_mm_h IS NULL;
DELETE FROM intensidad_lluvia WHERE intensidad_mm_h IS NULL;
ALTER TABLE intensidad_lluvia DROP CONSTRAINT ck_intensidad_valor;
ALTER TABLE intensidad_lluvia
    DROP COLUMN fecha_actualizacion,
    ALTER COLUMN intensidad_mm_h SET NOT NULL,
    ADD CONSTRAINT ck_intensidad_valor CHECK (intensidad_mm_h BETWEEN 10.00 AND 250.00);

-- 4. proyecto_ingeniero ----------------------------------------------------------
ALTER TABLE proyecto_ingeniero DROP COLUMN fecha_union;

-- 5. reporte_pdf ----------------------------------------------------------------
ALTER TABLE reporte_pdf DROP CONSTRAINT ck_reporte_tamano;
ALTER TABLE reporte_pdf
    DROP COLUMN nombre_archivo,
    DROP COLUMN tamano_bytes,
    ADD CONSTRAINT ck_reporte_tamano CHECK (OCTET_LENGTH(contenido) BETWEEN 1 AND 10*1024*1024); -- 10 MB

COMMIT;
