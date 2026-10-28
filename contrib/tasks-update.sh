#!/usr/bin/env bash
# Manual updater for the existing Tasks systemd installation.
set -Eeuo pipefail

source_dir=/srv/tasks/source
install_dir=/opt/tasks
backup_root=/var/backups/tasks
state_dir=/var/lib/tasks
config_dir=/etc/tasks
unit_dir=/etc/systemd/system
credential_file=/etc/credstore.encrypted/tasks-signing-secret
lock_file=/run/tasks-update.lock
health_url=http://127.0.0.1:3456/api/v2/info
service=tasks.service

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

build_as_user() {
    sudo -H -u "$build_user" bash -Eeuo pipefail -c '
        export PATH="/usr/local/bin:/usr/bin:/bin:/snap/bin:$PATH"
        export PATH="$(go env GOPATH)/bin:$PATH"
        cd "$1"
        test -z "$(git status --porcelain)" || { echo "ERROR: hay cambios locales en el repositorio" >&2; exit 1; }
        git pull --ff-only
        pnpm --dir frontend install --frozen-lockfile
        pnpm --dir frontend build
        mage build
        test -z "$(git status --porcelain)" || { echo "ERROR: la compilación modificó archivos del repositorio" >&2; exit 1; }
    ' bash "$source_dir"
}

cleanup() {
    local status=$?
    trap - EXIT
    if [[ -n ${next_link:-} && -L $next_link ]]; then
        rm -- "$next_link"
    fi
    if (( status != 0 )); then
        if (( stopped )) && [[ $(readlink -e "$install_dir/current") == "$previous" ]]; then
            printf 'No se ha cambiado de versión. Arrancando la versión vigente.\n' >&2
            systemctl start "$service" || true
        elif (( stopped )); then
            activated=1
        fi
        if [[ -n ${snapshot:-} ]]; then
            printf 'Copia y diagnóstico: %s\n' "$snapshot" >&2
        fi
        if (( activated )); then
            printf 'La versión nueva llegó a activarse. No se revierte automáticamente: puede haber migraciones.\nConsulta: sudo journalctl -u %s -n 50 --no-pager\n' "$service" >&2
        fi
    fi
    exit "$status"
}

main() {
    if [[ ${1:-} == --help ]]; then
        printf 'Uso: sudo tasks-update\nActualiza, compila, hace una copia consistente y activa Tasks.\n'
        return
    fi
    (( $# == 0 )) || fail 'No se admiten argumentos; usa --help para la ayuda.'
    (( EUID == 0 )) || fail 'Ejecuta este comando con sudo.'
    build_user=${SUDO_USER:-}
    [[ -n $build_user && $build_user != root ]] || fail 'Ejecuta sudo tasks-update desde tu usuario normal, no desde una sesión root.'
    for tool in sudo git flock tar curl systemctl install mktemp readlink stat sha256sum; do
        command -v "$tool" >/dev/null || fail "Falta el comando $tool."
    done
    exec 9>"$lock_file"
    flock -n 9 || fail 'Ya hay otra actualización en curso.'
    [[ -d $source_dir/.git ]] || fail "No se encuentra el checkout en $source_dir."
    [[ $(stat -c %u "$source_dir") == "$(id -u "$build_user")" ]] || fail 'El repositorio debe pertenecer al usuario que ejecuta sudo.'
    [[ -L $install_dir/current ]] || fail 'current debe ser un enlace a la versión instalada.'
    previous=$(readlink -e "$install_dir/current")
    [[ $previous == "$install_dir/releases/"* && -x $previous/tasks ]] || fail 'La versión vigente no está dentro de releases.'
    systemctl is-active --quiet "$service" || fail 'Tasks no está activo. Revisa el servicio antes de actualizar.'
    [[ $(systemctl show "$service" -p ExecStart --value) == *"$install_dir/current/tasks"* ]] || fail 'El servicio no usa el ejecutable current/tasks esperado.'
    for path in "$state_dir" "$config_dir" "$unit_dir/$service" "$unit_dir/$service.d" "$credential_file"; do
        [[ -e $path ]] || fail "No existe una ruta necesaria para la copia: $path"
    done

    printf '1/4 Descargar y compilar como %s. Tasks sigue funcionando.\n' "$build_user"
    build_as_user
    revision=$(sudo -H -u "$build_user" git -C "$source_dir" rev-parse HEAD)
    [[ $revision =~ ^[0-9a-f]{40}$ ]] || fail 'Revisión Git no válida.'
    [[ -f $source_dir/vikunja && ! -L $source_dir/vikunja && -x $source_dir/vikunja ]] || fail 'No se ha generado el binario ejecutable.'

    stopped=0 activated=0 snapshot='' next_link=''
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    install -d -o root -g root -m 0755 "$install_dir/releases"
    release=$(mktemp -d "$install_dir/releases/$revision-XXXXXXXX")
    chmod 0755 "$release"
    install -o root -g root -m 0755 "$source_dir/vikunja" "$release/tasks"
    install -d -o root -g root -m 0700 "$backup_root"
    snapshot=$(mktemp -d "$backup_root/update-$(date +%Y%m%d-%H%M%S)-XXXXXXXX")
    printf '%s\n' "$previous" >"$snapshot/previous-release.txt"
    printf '%s\n' "$revision" >"$snapshot/new-revision.txt"

    printf '2/4 Detener Tasks y crear la copia en %s\n' "$snapshot"
    stopped=1
    systemctl stop "$service"
    tar -C / -cpf "$snapshot/backup.tar" \
        "${state_dir#/}" "${config_dir#/}" "${unit_dir#/}/$service" \
        "${unit_dir#/}/$service.d" "${credential_file#/}" \
        "${install_dir#/}/current" "${previous#/}"
    chmod 0600 "$snapshot/backup.tar"
    tar -tf "$snapshot/backup.tar" >/dev/null
    (cd "$snapshot" && sha256sum backup.tar >backup.sha256)

    printf '3/4 Activar la revisión %s\n' "$revision"
    next_link="$install_dir/.current-update-$$"
    ln -s "$release" "$next_link"
    mv -Tf "$next_link" "$install_dir/current"
    activated=1
    systemctl start "$service"

    printf '4/4 Comprobar servicio y API\n'
    curl --fail --silent --show-error --retry 20 --retry-connrefused --retry-delay 1 \
        --connect-timeout 3 --max-time 10 --retry-max-time 90 "$health_url"
    printf '\n'
    systemctl is-active --quiet "$service"
    printf 'Tasks actualizado. Revisión: %s\nCopia: %s\nRecarga la web con Ctrl+F5.\n' "$revision" "$snapshot"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
