import { useEffect, useMemo, useRef, useState } from "react";

import { Joystick } from "react-joystick-component";
import { type IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { getAnglesFromPosition } from "@/lib/inverse-kinematics";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { clamp } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { NumberInput } from "@/components/NumberInput";
import { Separator } from "@/components/ui/separator";

type Direction = "X" | "Y" | "Z";

const DEFAULT_ESP_32_IP = "192.168.4.1";

const MAX_END_EFFECTOR_X = 270;
const MIN_END_EFFECTOR_X = -270;
const END_EFFECTOR_X_STEP = 10;

const MAX_END_EFFECTOR_Y = 270;
const MIN_END_EFFECTOR_Y = -270;
const END_EFFECTOR_Y_STEP = 10;

const MAX_END_EFFECTOR_Z = 530;
const MIN_END_EFFECTOR_Z = 150;
const END_EFFECTOR_Z_STEP = 2;

const END_EFFECTOR_RADIUS = 45; // r
const END_EFFECTOR_TO_MID_JOINT_LENGTH = 100; // l
const MID_JOINT_TO_BASE_LENGTH = 340; // L
const BASE_RADIUS = 105 / 2; // R
const INITIAL_END_EFFECTOR_POSITION = {
  x: 0,
  y: 0,
  z: 323,
} as const;

const ANGLE_SEPARATOR = ",";

const parseLastMessage = (lastMessage: string | null) => {
  if (!lastMessage) {
    return null;
  }

  const angles = lastMessage.split(ANGLE_SEPARATOR);

  if (angles.length !== 3) {
    return null;
  }

  return {
    theta1: parseFloat(angles[0]),
    theta2: parseFloat(angles[1]),
    theta3: parseFloat(angles[2]),
  };
};
class SignalConverter {
  private joystickState: IJoystickUpdateEvent | null = null;

  private setIntervalId: ReturnType<typeof setInterval> | null;
  private readonly signalRate: number;
  private handleJoystickUpdateEvent: (
    joystickState: IJoystickUpdateEvent | null
  ) => void;

  private isPaused = false;
  constructor(
    rate: number,
    handleJoystickUpdateEvent: (
      joystickState: IJoystickUpdateEvent | null
    ) => void
  ) {
    this.setIntervalId = null;
    this.signalRate = rate;
    this.handleJoystickUpdateEvent = handleJoystickUpdateEvent;
  }

  onStart(callback: (joystickState: IJoystickUpdateEvent | null) => void) {
    this.isPaused = false;
    this.setIntervalId = setInterval(() => {
      if (this.isPaused) {
        return;
      }
      this.handleJoystickUpdateEvent = callback;
      this.handleJoystickUpdateEvent(this.joystickState);
    }, this.signalRate);
  }

  onMove(joystickUpdate: IJoystickUpdateEvent) {
    this.joystickState = joystickUpdate;
  }

  onStop() {
    this.joystickState = null;
    this.isPaused = true;
    if (this.setIntervalId) {
      clearInterval(this.setIntervalId);
    }
  }
}

function App() {
  const [endEffectorRadius, setEndEffectorRadius] =
    useState<number>(END_EFFECTOR_RADIUS); // r
  const [endEffectorToMidJointLength, setEndEffectorToMidJointLength] =
    useState<number>(END_EFFECTOR_TO_MID_JOINT_LENGTH); // l
  const [midJointToBaseLength, setMidJointToBaseLength] = useState<number>(
    MID_JOINT_TO_BASE_LENGTH
  ); // L
  const [baseRadius, setBaseRadius] = useState<number>(BASE_RADIUS); // R
  const [isSendingAngles, setIsSendingAngles] = useState<boolean>(false);

  const [endEffectorPosition, setEndEffectorPosition] = useState<{
    x: number;
    y: number;
    z: number;
  }>(INITIAL_END_EFFECTOR_POSITION);

  const [apIP, setApIP] = useState<string>(DEFAULT_ESP_32_IP);

  const socketUrl = `ws://${apIP}/ws`;

  const { sendMessage, readyState, lastMessage } = useWebSocket(socketUrl);

  const actualAngles = useMemo(() => {
    return parseLastMessage(lastMessage?.data);
  }, [lastMessage]);

  const angles = useMemo(() => {
    return getAnglesFromPosition({
      endEffectorPosition,
      endEffectorRadius,
      endEffectorToMidJointLength,
      midJointToBaseLength,
      baseRadius,
    });
  }, [
    endEffectorPosition,
    endEffectorRadius,
    endEffectorToMidJointLength,
    midJointToBaseLength,
    baseRadius,
  ]);

  const onMoveJoyStick = (event: IJoystickUpdateEvent | null) => {
    setEndEffectorPosition((prev) => {
      if (!event) {
        return prev;
      }

      if (!event.x || !event.y) {
        return prev;
      }

      const xStep = END_EFFECTOR_X_STEP * (animationSpeed / 10);
      const yStep = END_EFFECTOR_Y_STEP * (animationSpeed / 10);

      const deltaX = xStep * event.x;
      const deltaY = yStep * event.y;

      const newX = Math.round(prev.x + deltaX);
      const newY = Math.round(prev.y + deltaY);

      return {
        ...prev,
        x: clamp(newX, MIN_END_EFFECTOR_X, MAX_END_EFFECTOR_X),
        y: clamp(newY, MIN_END_EFFECTOR_Y, MAX_END_EFFECTOR_Y),
      };
    });
  };

  const signalConverterRef = useRef<SignalConverter>(
    new SignalConverter(100, onMoveJoyStick)
  );

  useEffect(() => {
    if (!angles || !isSendingAngles) {
      return;
    }

    console.log("Sending angles", angles);

    sendMessage(
      `${angles.theta1}${ANGLE_SEPARATOR}${angles.theta2}${ANGLE_SEPARATOR}${angles.theta3}`
    );
  }, [angles, sendMessage, readyState, isSendingAngles]);

  const handleStart = () => {
    setIsSendingAngles(true);
    signalConverterRef.current.onStart(onMoveJoyStick);
  };

  const handleMove = (event: IJoystickUpdateEvent) => {
    signalConverterRef.current.onMove(event);
  };

  const handleStop = () => {
    signalConverterRef.current.onStop();
    setIsSendingAngles(false);
  };

  const animationRequestRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number | null>(null);
  const lastAnimationTimestampRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationSpeed, setAnimationSpeed] = useState<number>(5); // 1-10

  const startAnimation = () => {
    setIsAnimating(true);
    setIsSendingAngles(true);
  };

  const cancelAnimation = () => {
    if (animationRequestRef.current) {
      cancelAnimationFrame(animationRequestRef.current);
    }

    animationRequestRef.current = null;
    animationStartTimeRef.current = null;
    lastAnimationTimestampRef.current = null;
    setIsAnimating(false);
    setIsSendingAngles(false);
  };

  const xDirectionRef = useRef<number>(1);
  const xBound = useRef<{
    min: number;
    max: number;
  }>({
    min: INITIAL_END_EFFECTOR_POSITION.x - 80,
    max: INITIAL_END_EFFECTOR_POSITION.x + 80,
  });

  const yDirectionRef = useRef<number>(1);
  const yBound = useRef<{
    min: number;
    max: number;
  }>({
    min: INITIAL_END_EFFECTOR_POSITION.y - 80,
    max: INITIAL_END_EFFECTOR_POSITION.y + 80,
  });
  const zDirectionRef = useRef<number>(1);
  const zBound = useRef<{
    min: number;
    max: number;
  }>({
    min: INITIAL_END_EFFECTOR_POSITION.z - 80,
    max: INITIAL_END_EFFECTOR_POSITION.z + 80,
  });

  const startPresetMovement = (timestamp: number, directions: Direction[]) => {
    if (!animationStartTimeRef.current) {
      animationStartTimeRef.current = timestamp;
    }

    if (!lastAnimationTimestampRef.current) {
      lastAnimationTimestampRef.current = timestamp;
    }

    const timeElapsed = timestamp - animationStartTimeRef.current;

    if (timeElapsed >= 10000) {
      cancelAnimation();
      return;
    }

    const timeElapsedSinceLastUpdate =
      timestamp - lastAnimationTimestampRef.current;

    // Skip update
    const waitTime = 100 / animationSpeed;

    if (timeElapsedSinceLastUpdate < waitTime) {
      animationRequestRef.current = requestAnimationFrame((timestamp) =>
        startPresetMovement(timestamp, directions)
      );
      return;
    }

    lastAnimationTimestampRef.current = timestamp;

    setEndEffectorPosition((prev) => {
      const hasReachedMaxX = Math.abs(prev.x - xBound.current.max) <= 1;
      if (hasReachedMaxX) {
        xDirectionRef.current = -1;
      }
      const hasReachedMinX = Math.abs(prev.x - xBound.current.min) <= 1;
      if (hasReachedMinX) {
        xDirectionRef.current = 1;
      }

      const hasReachedMaxY = Math.abs(prev.y - yBound.current.max) <= 1;
      if (hasReachedMaxY) {
        yDirectionRef.current = -1;
      }
      const hasReachedMinY = Math.abs(prev.y - yBound.current.min) <= 1;
      if (hasReachedMinY) {
        yDirectionRef.current = 1;
      }

      const hasReachedMaxZ = Math.abs(prev.z - zBound.current.max) <= 1;
      if (hasReachedMaxZ) {
        zDirectionRef.current = -1;
      }
      const hasReachedMinZ = Math.abs(prev.z - zBound.current.min) <= 1;
      if (hasReachedMinZ) {
        zDirectionRef.current = 1;
      }

      const deltaX = xDirectionRef.current * 1;
      const deltaY = yDirectionRef.current * 1;
      const deltaZ = zDirectionRef.current * 1;

      const newX = clamp(
        prev.x + deltaX,
        MIN_END_EFFECTOR_X,
        MAX_END_EFFECTOR_X
      );
      const newY = clamp(
        prev.y + deltaY,
        MIN_END_EFFECTOR_Y,
        MAX_END_EFFECTOR_Y
      );
      const newZ = clamp(
        prev.z + deltaZ,
        MIN_END_EFFECTOR_Z,
        MAX_END_EFFECTOR_Z
      );

      animationRequestRef.current = requestAnimationFrame((timestamp) =>
        startPresetMovement(timestamp, directions)
      );

      return {
        x: directions.includes("X") ? newX : prev.x,
        y: directions.includes("Y") ? newY : prev.y,
        z: directions.includes("Z") ? newZ : prev.z,
      };
    });
  };

  const lastApproachDefaultPositionTimestampRef = useRef<number | null>(null);
  const approachDefaultPosition = (timestamp: number) => {
    if (!lastApproachDefaultPositionTimestampRef.current) {
      lastApproachDefaultPositionTimestampRef.current = timestamp;
    }

    const timeElapsedSinceLastUpdate =
      timestamp - lastApproachDefaultPositionTimestampRef.current;

    // Skip update
    const waitTime = 100 / animationSpeed;
    if (timeElapsedSinceLastUpdate < waitTime) {
      animationRequestRef.current = requestAnimationFrame(
        approachDefaultPosition
      );
      return;
    }

    lastApproachDefaultPositionTimestampRef.current = timestamp;

    setEndEffectorPosition((prev) => {
      const deltaX = prev.x > INITIAL_END_EFFECTOR_POSITION.x ? -1 : 1;
      const deltaY = prev.y > INITIAL_END_EFFECTOR_POSITION.y ? -1 : 1;
      const deltaZ = prev.z > INITIAL_END_EFFECTOR_POSITION.z ? -1 : 1;

      const newX = clamp(
        prev.x + deltaX,
        MIN_END_EFFECTOR_X,
        MAX_END_EFFECTOR_X
      );

      const newY = clamp(
        prev.y + deltaY,
        MIN_END_EFFECTOR_Y,
        MAX_END_EFFECTOR_Y
      );

      const newZ = clamp(
        prev.z + deltaZ,
        MIN_END_EFFECTOR_Z,
        MAX_END_EFFECTOR_Z
      );

      const hasReachedDefaultX =
        Math.abs(newX - INITIAL_END_EFFECTOR_POSITION.x) <= 1;
      const hasReachedDefaultY =
        Math.abs(newY - INITIAL_END_EFFECTOR_POSITION.y) <= 1;
      const hasReachedDefaultZ =
        Math.abs(newZ - INITIAL_END_EFFECTOR_POSITION.z) <= 1;

      if (hasReachedDefaultX && hasReachedDefaultY && hasReachedDefaultZ) {
        cancelAnimation();
        return prev;
      }

      animationRequestRef.current = requestAnimationFrame(
        approachDefaultPosition
      );
      return {
        x: hasReachedDefaultX ? INITIAL_END_EFFECTOR_POSITION.x : newX,
        y: hasReachedDefaultY ? INITIAL_END_EFFECTOR_POSITION.y : newY,
        z: hasReachedDefaultZ ? INITIAL_END_EFFECTOR_POSITION.z : newZ,
      };
    });
  };

  const handleReset = () => {
    animationRequestRef.current = requestAnimationFrame(
      approachDefaultPosition
    );
  };

  const handleSliderValueChange = (values: number[]) => {
    setIsSendingAngles(true);
    setEndEffectorPosition((prev) => {
      const value = values.at(0);

      if (!value) {
        return prev;
      }

      return {
        ...prev,
        z: clamp(value, MIN_END_EFFECTOR_Z, MAX_END_EFFECTOR_Z),
      };
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApIP(event.target.value);
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const setXBound = (range: number) => {
    xBound.current = {
      min: Math.max(endEffectorPosition.x - range, MIN_END_EFFECTOR_X),
      max: Math.min(endEffectorPosition.x + range, MAX_END_EFFECTOR_X),
    };
  };

  const setYBound = (range: number) => {
    yBound.current = {
      min: Math.max(endEffectorPosition.y - range, MIN_END_EFFECTOR_Y),
      max: Math.min(endEffectorPosition.y + range, MAX_END_EFFECTOR_Y),
    };
  };

  const setZBound = (range: number) => {
    zBound.current = {
      min: Math.max(endEffectorPosition.z - range, MIN_END_EFFECTOR_Z),
      max: Math.min(endEffectorPosition.z + range, MAX_END_EFFECTOR_Z),
    };
  };

  return (
    <main className="flex flex-col justify-center items-center h-full">
      <section className="max-w-[512px] flex flex-col gap-4 justify-center items-center">
        <div>Connection Status: {connectionStatus}</div>

        <div className="flex flex-col justify-center items-center gap-4">
          <div className="flex flex-col justify-center items-center gap-4 min-w-60">
            <Label className="text-center">X,Y Positions</Label>
            <Joystick
              disabled={isAnimating}
              size={100}
              sticky={false}
              baseColor="red"
              stickColor="blue"
              move={handleMove}
              stop={handleStop}
              start={handleStart}
            />
          </div>

          <div className="flex flex-col justify-center items-center gap-4 min-w-60">
            <Label className="text-center">Z Position</Label>

            <Slider
              onValueCommit={() => {
                setIsSendingAngles(false);
              }}
              id="z-controller"
              className="w-full"
              value={[endEffectorPosition.z]}
              onValueChange={handleSliderValueChange}
              step={END_EFFECTOR_Z_STEP}
              min={MIN_END_EFFECTOR_Z}
              max={MAX_END_EFFECTOR_Z}
            />
          </div>
        </div>

        <Separator />
        <p>
          Trajectory movements: <br />
        </p>
        <div className="flex w-full justify-between gap-2">
          <Button
            disabled={isAnimating}
            onClick={() => {
              setXBound(80);
              setYBound(80);

              startAnimation();
              requestAnimationFrame((timestamp) =>
                startPresetMovement(timestamp, ["X", "Y"])
              );
            }}
          >
            XY
          </Button>
          <Button
            disabled={isAnimating}
            onClick={() => {
              setXBound(60);
              setZBound(50);
              startAnimation();
              requestAnimationFrame((timestamp) =>
                startPresetMovement(timestamp, ["X", "Z"])
              );
            }}
          >
            XZ
          </Button>
          <Button
            disabled={isAnimating}
            onClick={() => {
              setYBound(60);
              setZBound(50);
              startAnimation();
              requestAnimationFrame((timestamp) =>
                startPresetMovement(timestamp, ["Y", "Z"])
              );
            }}
          >
            YZ
          </Button>
        </div>

        <p>Reset to initial positions</p>
        <Button
          disabled={isAnimating}
          onClick={() => {
            startAnimation();
            handleReset();
          }}
        >
          Reset
        </Button>

        <div>
          <Label>Speed: {animationSpeed}</Label>
          <Input
            disabled={isAnimating}
            value={animationSpeed}
            onChange={(e) => {
              setAnimationSpeed(parseInt(e.target.value));
            }}
            className="p-0"
            type="range"
            min="1"
            max="10"
            step="1"
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-2 min-w-60">
          <div>End effector position:</div>
          <div>x: {endEffectorPosition.x}</div>
          <div>y: {endEffectorPosition.y}</div>
          <div>z: {endEffectorPosition.z}</div>
        </div>

        <div className="flex flex-col gap-2 min-w-60">
          <div>Calculated Angles:</div>
          <div>Theta 1: {angles?.theta1}</div>
          <div>Theta 2: {angles?.theta2}</div>
          <div>Theta 3: {angles?.theta3}</div>
        </div>

        <div className="flex flex-col gap-2 min-w-60">
          <div>Actual Angles:</div>
          <div>Theta 1: {actualAngles?.theta1}</div>
          <div>Theta 2: {actualAngles?.theta2}</div>
          <div>Theta 3: {actualAngles?.theta3}</div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <NumberInput
            disabled={isAnimating}
            id="end-effector-radius"
            label="End effector radius (r)"
            value={endEffectorRadius}
            onChange={setEndEffectorRadius}
          />

          <NumberInput
            disabled={isAnimating}
            id="base-radius"
            label="Base radius (R)"
            value={baseRadius}
            onChange={setBaseRadius}
          />

          <NumberInput
            disabled={isAnimating}
            id="end-effector-to-mid-joint-length"
            label="End effector to mid joint length (l)"
            value={endEffectorToMidJointLength}
            onChange={setEndEffectorToMidJointLength}
          />

          <NumberInput
            disabled={isAnimating}
            id="mid-joint-to-base-length"
            label="Mid joint to base length (L)"
            value={midJointToBaseLength}
            onChange={setMidJointToBaseLength}
          />
        </div>

        <Separator />

        <div>
          ESP32 AP IP:
          <Input
            disabled={isAnimating}
            value={apIP}
            onChange={handleInputChange}
            placeholder="Enter ESP IP"
          />
        </div>
      </section>
    </main>
  );
}

export default App;
