# Plan pendiente: perfiles y partidas multijugador con Supabase

**Estado:** guardado para más adelante; todavía no implementado.

## Objetivo

Permitir que cada jugador participe desde su propio teléfono, con un perfil
persistente y acciones asociadas a su identidad durante las partidas.

## Decisiones acordadas

- Usar Supabase Auth anónimo para crear una identidad por dispositivo sin pedir
  contraseña.
- Pedir un nombre de usuario visible para el perfil. El nombre es una etiqueta,
  no una prueba de identidad; las acciones se vinculan al ID interno de Auth.
- Permitir vincular la cuenta más adelante para recuperar el perfil, por ejemplo
  mediante correo con código o enlace, o mediante un proveedor como Google.
- Mantener preferencias locales en `localStorage`.
- No convertir automáticamente los nombres guardados actualmente en perfiles
  ni cuentas.

## Fases de trabajo

### 1. Preparar Supabase e identidad

- Crear el proyecto y configurar las variables públicas necesarias para el
  cliente de la app; nunca incluir la clave `service_role` en el frontend ni en
  el APK.
- Activar el inicio de sesión anónimo.
- Añadir una tabla `profiles` relacionada con `auth.users`, con nombre visible,
  avatar/color opcional y fechas de creación y actualización.
- Crear o completar el perfil tras el primer inicio de sesión y permitir editar
  el nombre visible.
- Conservar la sesión en el dispositivo y diseñar un flujo opcional para
  vincular un método de recuperación sin contraseña.

### 2. Crear partidas y salas

- Crear `game_rooms` con código de invitación, modo, estado, anfitrión y
  marcas de tiempo.
- Crear `room_players` para asociar cada sala con los perfiles que se unen desde
  sus propios teléfonos.
- Definir reglas de entrada, salida, reconexión, inicio de partida y cierre de
  sala.
- Mostrar el estado del grupo en tiempo real antes de comenzar.

### 3. Registrar acciones individuales

- Crear un modelo de rondas y una tabla `player_actions` vinculada a sala,
  ronda y `auth.uid()`.
- Guardar únicamente los datos necesarios para cada acción y modo.
- Definir restricciones e idempotencia para evitar que una reconexión o un
  doble toque duplique una respuesta.
- Sincronizar estado y marcador con Supabase Realtime.

### 4. Proteger los datos y la lógica

- Activar RLS en todas las tablas expuestas.
- Permitir que cada usuario lea y edite solo su perfil.
- Limitar la lectura y escritura de salas y acciones a sus participantes, según
  el rol que corresponda.
- Mantener en el servidor los secretos del juego, como la asignación del
  impostor, hasta que puedan revelarse.
- No confiar en puntuaciones, identidad o permisos enviados directamente por
  el cliente; validar las operaciones sensibles en servidor o mediante
  funciones RPC seguras.

### 5. Migrar gradualmente y probar

- Mantener disponibles los modos locales de un solo teléfono mientras se
  desarrolla el flujo multijugador.
- Implementar primero autenticación y creación/unión a una sala.
- Elegir un modo de juego como piloto y persistir sus acciones por jugador.
- Probar en varios teléfonos: permisos, sala llena o cerrada, desconexiones,
  reconexión, acciones repetidas, cambios de anfitrión y acceso indebido.
- Incorporar los demás modos solo después de validar el piloto.
- Documentar qué datos se sincronizan y cuáles siguen siendo locales.

## Esquema inicial a evaluar

- `profiles`: identidad pública asociada a un usuario de Supabase Auth.
- `game_rooms`: partidas compartidas y su estado.
- `room_players`: pertenencia y rol de cada perfil en una sala.
- `game_rounds`: rondas y configuración no secreta.
- `player_actions`: acciones de cada jugador, con restricciones de duplicados
  acordes al modo.

El esquema definitivo, las políticas RLS y las reglas de retención deben
definirse junto con el flujo de cada juego antes de crear migraciones.
