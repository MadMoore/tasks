# Mantener Tasks al día con Vikunja

Origen oficial: https://github.com/go-vikunja/vikunja, rama `main`.
El remoto `origin` sigue apuntando a https://github.com/MadMoore/tasks.

Las actualizaciones de Vikunja se integran mediante un merge normal de
`upstream/main` en una rama de trabajo de Tasks. No se usa `reset --hard`,
no se fuerza la rama para que coincida con upstream y no se resuelven los
conflictos eligiendo automáticamente toda una versión.

Antes de integrar, comprobar que el checkout está limpio y revisar los commits,
dependencias y migraciones nuevos. Si no existe el remoto:

```bash
git remote add upstream https://github.com/go-vikunja/vikunja.git
```

```bash
git fetch upstream main --no-tags
git log --oneline HEAD..upstream/main
git merge --no-ff upstream/main
```

Resolver cualquier conflicto conservando la intención de ambos cambios. Los
clientes generados se regeneran desde la API; no se editan a mano. Revisar también
los conflictos de comportamiento aunque Git combine los archivos sin avisos.

Mantener y comprobar las personalizaciones de Tasks:

- Marca Tasks, llama y atribución a Vikunja.
- Buscador sin creación de tareas y foco por fecha de inicio, prioridad y máximo
  de cinco tareas abiertas; proyectos en cuadrícula 6/3/2.
- Filtro opcional `sourceBucketId` en otras vistas.
- Fotos de agentes, permisos de propietario y fotos en comentarios existentes.
- Actualizador manual, copia consistente y recuperación ante errores.

Para revisiones programadas, preparar una candidata `tasks/upstream-*` desde la
rama de entrega vigente. Su push ejecuta `Tasks checks` sin desplegar ni requerir
que esta PR ya se haya integrado en la rama predeterminada. Solo tras pasar las
pruebas, avanzar la entrega mediante fast-forward si su revisión no cambió;
si hay cambios concurrentes, integrar y validar de nuevo.

`Tasks checks` comprueba la compilación de frontend/API, cliente generado,
pruebas del fork y pruebas de los componentes upstream afectados. Ampliar esas
pruebas según cambie el alcance; no considerar suficiente un merge sin conflictos.
Las pruebas del actualizador usan archivos sintéticos y servicios simulados.

Dejar en la PR el SHA upstream integrado, los cambios relevantes, las migraciones
y los resultados reales de las pruebas. No anunciar una actualización como lista
si las comprobaciones fallan. No integrar en `main` sin la autorización
correspondiente ni acceder al servidor para desplegar.

`sudo tasks-update` descarga del fork de Tasks. La integración de Vikunja se
hace durante el mantenimiento del código, antes de la instalación manual.
Una nueva migración requiere conservar la copia previa y revisar la recuperación;
no volver automáticamente al ejecutable anterior.
