import { useCallback, useEffect, useRef, useState } from "react";
import { Motion } from "@capacitor/motion";

export type CharadesAction = "correct" | "skip";
type SensorStatus = "idle" | "connecting" | "calibrating" | "ready" | "manual";

type MotionPermissionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

function normalizeAngle(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

export function useCharadesSensors(
  isActive: boolean,
  onAction: (action: CharadesAction) => void,
) {
  const [sensorEnabled, setSensorEnabled] = useState(false);
  const [status, setStatus] = useState<SensorStatus>("idle");
  const [message, setMessage] = useState("");
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  const requestSensorAccess = useCallback(async () => {
    setMessage("");
    try {
      if (typeof window.DeviceMotionEvent === "undefined") {
        setSensorEnabled(false);
        setStatus("manual");
        setMessage("Este dispositivo no ofrece sensor de movimiento; usa los botones.");
        return;
      }

      const motionConstructor =
        window.DeviceMotionEvent as MotionPermissionConstructor;
      if (motionConstructor.requestPermission) {
        const permission = await motionConstructor.requestPermission();
        if (permission !== "granted") {
          setSensorEnabled(false);
          setStatus("manual");
          setMessage("Permiso de movimiento denegado. Puedes jugar con los botones.");
          return;
        }
      }

      setSensorEnabled(true);
      setStatus("connecting");
      setMessage("Coloca el móvil neutro en la frente para calibrar.");
    } catch (error) {
      setSensorEnabled(false);
      setStatus("manual");
      setMessage(
        error instanceof Error
          ? `No se pudo activar el sensor: ${error.message}`
          : "No se pudo activar el sensor. Puedes jugar con los botones.",
      );
    }
  }, []);

  useEffect(() => {
    if (!isActive || !sensorEnabled) return;

    let disposed = false;
    let hasReceivedMotion = false;
    let baselineAngle: number | null = null;
    let calibrationSamples: number[] = [];
    let armed = true;
    let cooldownUntil = 0;
    let neutralSamples = 0;
    let listener: { remove: () => Promise<void> } | undefined;

    setStatus("connecting");
    const noMotionTimer = window.setTimeout(() => {
      if (!hasReceivedMotion && !disposed) {
        setStatus("manual");
        setMessage("No se detecta movimiento; los botones táctiles siguen disponibles.");
      }
    }, 2500);

    void Motion.addListener("accel", (event) => {
      if (disposed) return;

      const { x, y, z } = event.accelerationIncludingGravity;
      const orientationAngle = window.screen.orientation?.angle ?? 0;
      const isLandscape = Math.abs(orientationAngle % 180) === 90;
      const pitchAxis = isLandscape
        ? x * (orientationAngle === 270 ? -1 : 1)
        : y;
      if (
        !Number.isFinite(pitchAxis) ||
        !Number.isFinite(z) ||
        Math.hypot(pitchAxis, z) < 1
      ) {
        return;
      }
      hasReceivedMotion = true;
      window.clearTimeout(noMotionTimer);

      const currentAngle = (Math.atan2(pitchAxis, z) * 180) / Math.PI;
      if (baselineAngle === null) {
        calibrationSamples.push(currentAngle);
        setStatus("calibrating");
        if (calibrationSamples.length >= 8) {
          baselineAngle =
            calibrationSamples.reduce((sum, sample) => sum + sample, 0) /
            calibrationSamples.length;
          calibrationSamples = [];
          setStatus("ready");
          setMessage("¡Sensor listo! Inclina hacia arriba para acertar y abajo para pasar.");
        }
        return;
      }

      const tilt = normalizeAngle(currentAngle - baselineAngle);
      if (!armed) {
        if (Date.now() >= cooldownUntil && Math.abs(tilt) < 18) {
          neutralSamples += 1;
          if (neutralSamples >= 3) {
            armed = true;
            neutralSamples = 0;
            baselineAngle = currentAngle;
          }
        } else {
          neutralSamples = 0;
        }
        return;
      }

      if (tilt >= 45) {
        armed = false;
        cooldownUntil = Date.now() + 1200;
        onActionRef.current("correct");
      } else if (tilt <= -45) {
        armed = false;
        cooldownUntil = Date.now() + 1200;
        onActionRef.current("skip");
      }
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listener = handle;
      }
    }).catch((error: unknown) => {
      if (disposed) return;
      setStatus("manual");
      setMessage(
        error instanceof Error
          ? `No se pudo conectar con el sensor: ${error.message}`
          : "No se pudo conectar con el sensor. Usa los botones táctiles.",
      );
    });

    return () => {
      disposed = true;
      window.clearTimeout(noMotionTimer);
      if (listener) {
        void listener.remove().catch((error: unknown) => {
          console.error("No se pudo detener el sensor de Charadas.", error);
        });
      }
    };
  }, [isActive, sensorEnabled]);

  return { message, requestSensorAccess, status };
}
