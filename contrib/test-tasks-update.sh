#!/usr/bin/env bash
# Exercise failure recovery with synthetic files and mocked service/build commands.
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if [[ ${1:-} == --case ]]; then
    scenario=$2
    test_root=$3
    # shellcheck source=contrib/tasks-update.sh
    source "$script_dir/tasks-update.sh"
    source_dir="$test_root/source"
    install_dir="$test_root/install"
    backup_root="$test_root/backups"
    state_dir="$test_root/data"
    config_dir="$test_root/config"
    unit_dir="$test_root/systemd"
    credential_file="$test_root/credential"
    lock_file="$test_root/lock"
    export SUDO_USER=nobody
    mkdir -p "$source_dir" "$install_dir/releases/old" "$state_dir" "$config_dir" "$unit_dir/$service.d"
    printf 'original data\n' >"$state_dir/database"
    touch "$credential_file" "$unit_dir/$service" "$install_dir/releases/old/tasks"
    chmod +x "$install_dir/releases/old/tasks"
    ln -s "$install_dir/releases/old" "$install_dir/current"
    command git -C "$source_dir" init -q
    command git -C "$source_dir" -c user.name=Test -c user.email=test@example.com commit -qm initial --allow-empty
    chown -R nobody "$source_dir"

    sudo() {
        shift 3 # -H -u nobody
        command git -c safe.directory="$source_dir" "${@:2}"
    }
    build_as_user() {
        printf 'build\n' >>"$test_root/events"
        [[ $scenario != build-failure ]] || return 1
        printf 'new binary\n' >"$source_dir/vikunja"
        chmod +x "$source_dir/vikunja"
    }
    systemctl() {
        case $1 in
            show) printf '%s/current/tasks\n' "$install_dir" ;;
            is-active) return 0 ;;
            stop) printf 'stop\n' >>"$test_root/events" ;;
            start)
                printf 'start\n' >>"$test_root/events"
                [[ $scenario != start-failure ]]
                ;;
            *) return 1 ;;
        esac
    }
    tar() {
        if [[ $scenario == backup-failure && $1 == -C ]]; then
            return 1
        fi
        command tar "$@"
    }
    curl() {
        [[ $scenario != health-failure ]] || return 1
        printf '{"version":"test"}'
    }
    main
    exit
fi

(( EUID == 0 )) || { echo 'Run these isolated tests with sudo.' >&2; exit 1; }
test_root=$(mktemp -d /tmp/tasks-updater-test.XXXXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
for scenario in success build-failure backup-failure start-failure health-failure; do
    case_root="$test_root/$scenario"
    mkdir -p "$case_root"
    if bash "$0" --case "$scenario" "$case_root" >"$case_root/output" 2>&1; then
        [[ $scenario == success ]] || { cat "$case_root/output"; exit 1; }
    else
        [[ $scenario != success ]] || { cat "$case_root/output"; exit 1; }
    fi
    current=$(readlink "$case_root/install/current")
    case $scenario in
        build-failure)
            [[ $current == "$case_root/install/releases/old" ]]
            ! grep -q '^stop$' "$case_root/events"
            [[ ! -d $case_root/backups ]]
            ;;
        backup-failure)
            [[ $current == "$case_root/install/releases/old" ]]
            [[ $(tail -n 1 "$case_root/events") == start ]]
            ;;
        *)
            [[ $current != "$case_root/install/releases/old" ]]
            [[ $(cat "$current/tasks") == 'new binary' ]]
            snapshots=("$case_root"/backups/*)
            [[ ${#snapshots[@]} == 1 ]]
            (cd "${snapshots[0]}" && sha256sum --check backup.sha256 >/dev/null)
            tar -xOf "${snapshots[0]}/backup.tar" "${case_root#/}/data/database" | grep -qx 'original data'
            [[ $(cat "${snapshots[0]}/previous-release.txt") == "$case_root/install/releases/old" ]]
            ;;
    esac
    printf 'PASS %s\n' "$scenario"
done
