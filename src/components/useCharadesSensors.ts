import { useCallback, useEffect, useRef, useState } from "react";
import { Motion } from "@capacitor/motion";

export type CharadesAction = "correct" | "skip";
type SensorStatus = "idle" | "connecting" | "calibrating" | "ready" | "manual";

type SensorPermissionConstructor = {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

const correctTiltThreshold = 70;
const skipTiltThreshold = -30;
const neutralTiltThreshold = 14;
const sensorCooldown = 800;
const tiltHoldDuration = 250;

function normalizeAngle(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

function averageAngles(angles: number[]) {
  const sineTotal = angles.reduce(
    (total, angle) => total + Math.sin((angle * Math.PI) / 180),
    0,
  );
  const cosineTotal = angles.reduce(
    (total, angle) => total + Math.cos((angle * Math.PI) / 180),
    0,
  );
  return (Math.atan2(sineTotal, cosineTotal) * 180) / Math.PI;
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
      if (
        typeof window.DeviceMotionEvent === "undefined" &&
        typeof window.DeviceOrientationEvent === "undefined"
      ) {
        setSensorEnabled(false);
        setStatus("manual");
        setMessage("Este dispositivo no ofrece sensor de movimiento; usa los botones.");
        return;
      }

      const motionConstructor =
        window.DeviceMotionEvent as SensorPermissionConstructor | undefined;
      const orientationConstructor =
        window.DeviceOrientationEvent as
          | SensorPermissionConstructor
          | undefined;
      const permissionConstructor = motionConstructor?.requestPermission
        ? motionConstructor
        : orientationConstructor;
      if (permissionConstructor?.requestPermission) {
        const permission = await permissionConstructor.requestPermission();
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
    let sensorSource: "orientation" | "acceleration" | null = null;
    let accelerationSamples: number[] = [];
    let pendingAction: CharadesAction | null = null;
    let holdTimeout = 0;
    let listener: { remove: () => Promise<void> } | undefined;

    setStatus("connecting");
    const noMotionTimer = window.setTimeout(() => {
      if (!hasReceivedMotion && !disposed) {
        setStatus("manual");
        setMessage("No se detecta movimiento; los botones táctiles siguen disponibles.");
      }
    }, 2500);

    const processAngle = (currentAngle: number) => {
      if (baselineAngle === null) {
        calibrationSamples.push(currentAngle);
        setStatus("calibrating");
        if (calibrationSamples.length >= 8) {
          baselineAngle = averageAngles(calibrationSamples);
          calibrationSamples = [];
          setStatus("ready");
          setMessage(
            "¡Sensor listo! Inclina hacia atrás para acertar y hacia delante para pasar.",
          );
        }
        return;
      }

      const tilt = normalizeAngle(currentAngle - baselineAngle);
      if (pendingAction) {
        const stillBeyondThreshold =
          pendingAction === "correct"
            ? tilt > correctTiltThreshold
            : tilt < skipTiltThreshold;
        if (!stillBeyondThreshold) {
          window.clearTimeout(holdTimeout);
          pendingAction = null;
        }
        return;
      }

      if (!armed) {
        if (
          Date.now() >= cooldownUntil &&
          Math.abs(tilt) < neutralTiltThreshold
        ) {
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

      const action =
        tilt > correctTiltThreshold
          ? "correct"
          : tilt < skipTiltThreshold
            ? "skip"
            : null;
      if (!action) return;

      pendingAction = action;
      holdTimeout = window.setTimeout(() => {
        if (disposed || !armed || pendingAction !== action) return;
        pendingAction = null;
        armed = false;
        cooldownUntil = Date.now() + sensorCooldown;
        onActionRef.current(action);
      }, tiltHoldDuration);
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (
        disposed ||
        sensorSource === "acceleration" ||
        typeof event.beta !== "number" ||
        !Number.isFinite(event.beta)
      ) {
        return;
      }

      sensorSource = "orientation";
      hasReceivedMotion = true;
      window.clearTimeout(noMotionTimer);
      processAngle(event.beta);
    };
    window.addEventListener("deviceorientation", handleOrientation);

    const accelerationFallbackTimer = window.setTimeout(() => {
      if (sensorSource !== null) return;
      sensorSource = "acceleration";
      accelerationSamples.forEach(processAngle);
      accelerationSamples = [];
    }, 750);

    void Motion.addListener("accel", (event) => {
      if (disposed || sensorSource === "orientation") return;

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
      if (sensorSource === "acceleration") {
        processAngle(currentAngle);
      } else {
        accelerationSamples.push(currentAngle);
        if (accelerationSamples.length > 8) accelerationSamples.shift();
      }
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listener = handle;
      }
    }).catch((error: unknown) => {
      if (disposed) return;
      if (sensorSource === "orientation") return;
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
      window.clearTimeout(accelerationFallbackTimer);
      window.clearTimeout(holdTimeout);
      window.removeEventListener("deviceorientation", handleOrientation);
      if (listener) {
        void listener.remove().catch((error: unknown) => {
          console.error("No se pudo detener el sensor de Charadas.", error);
        });
      }
    };
  }, [isActive, sensorEnabled]);

  return { message, requestSensorAccess, status };
}
