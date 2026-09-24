import type { PointerEvent } from "react";

/**
 * Stisk tlačítka viditelný i na iOS.
 *
 * Safari nastaví :active jen tehdy, když na stránce visí posluchač dotyku,
 * a ani pak ne při každém krátkém ťuknutí. Tady se stav zapíše rovnou
 * do atributu uzlu — bez stavu v Reactu, takže klávesa nic nepřekresluje
 * a rozsvítí se ve stejném snímku, kdy se jí palec dotkne. Vzhled drží
 * třída `.press` a varianta `data-pressed:` v globals.css.
 */
function down(event: PointerEvent<HTMLElement>) {
  event.currentTarget.dataset.pressed = "";
}

function up(event: PointerEvent<HTMLElement>) {
  delete event.currentTarget.dataset.pressed;
}

export const pressable = {
  onPointerDown: down,
  onPointerUp: up,
  onPointerCancel: up,
  onPointerLeave: up,
} as const;
