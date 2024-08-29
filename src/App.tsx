import { useMemo, useRef, useState } from "react";

import { Joystick } from "react-joystick-component";
import { type IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { getAnglesFromPosition } from "@/lib/inverse-kinematics";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { clamp, truncateFloat } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_ESP_32_IP = "192.168.4.1";

const MAX_END_EFFECTOR_X = 2.7;
const MIN_END_EFFECTOR_X = -2.3;
const END_EFFECTOR_X_STEP = 0.01;

const MAX_END_EFFECTOR_Y = 2.7;
const END_EFFECTOR_Y_STEP = 0.01;
const MIN_END_EFFECTOR_Y = -2.7;

const MAX_END_EFFECTOR_Z = -1.28;
const MIN_END_EFFECTOR_Z = -3.4;

const END_EFFECTOR_RADIUS = 1;
const END_EFFECTOR_TO_MID_JOINT_LENGTH = 1;
const MID_JOINT_TO_BASE_LENGTH = 3;
const BASE_RADIUS = 2;
const INITIAL_END_EFFECTOR_POSITION = {
  x: 1,
  y: 0.2,
  z: -3,
} as const;
class SignalConverter {
  private joystickState: IJoystickUpdateEvent | null = null;

  private setIntervalId: ReturnType<typeof setInterval> | null;
  private readonly signalRate: number;
  private readonly handleJoystickUpdateEvent: (
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

  onStart() {
    this.isPaused = false;
    this.setIntervalId = setInterval(() => {
      if (this.isPaused) {
        return;
      }
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
  const [endEffectorPosition, setEndEffectorPosition] = useState<{
    x: number;
    y: number;
    z: number;
  }>(INITIAL_END_EFFECTOR_POSITION);

  const [apIP, setApIP] = useState<string>(DEFAULT_ESP_32_IP);

  const signalConverterRef = useRef<SignalConverter>(
    new SignalConverter(100, (joystickState) => {
      setEndEffectorPosition((prev) => {
        if (!joystickState) {
          return prev;
        }

        if (!joystickState.x || !joystickState.y) {
          return prev;
        }

        const deltaX = END_EFFECTOR_X_STEP * joystickState.x;
        const deltaY = END_EFFECTOR_Y_STEP * joystickState.y;

        const newX = truncateFloat(prev.x + deltaX, 4);
        const newY = truncateFloat(prev.y + deltaY, 4);

        return {
          ...prev,
          x: clamp(newX, MIN_END_EFFECTOR_X, MAX_END_EFFECTOR_X),
          y: clamp(newY, MIN_END_EFFECTOR_Y, MAX_END_EFFECTOR_Y),
        };
      });
    })
  );

  const angles = useMemo(() => {
    return getAnglesFromPosition({
      endEffectorPosition: endEffectorPosition,
      endEffectorRadius: END_EFFECTOR_RADIUS,
      endEffectorToMidJointLength: END_EFFECTOR_TO_MID_JOINT_LENGTH,
      midJointToBaseLength: MID_JOINT_TO_BASE_LENGTH,
      baseRadius: BASE_RADIUS,
    });
  }, [endEffectorPosition]);

  const handleStart = () => {
    signalConverterRef.current.onStart();
  };

  const handleMove = (event: IJoystickUpdateEvent) => {
    signalConverterRef.current.onMove(event);
  };

  const handleStop = () => {
    signalConverterRef.current.onStop();
    sendAnglesToESP();
  };

  const handleReset = () => {
    setEndEffectorPosition(INITIAL_END_EFFECTOR_POSITION);
    sendAnglesToESP();
  };

  const handleSliderValueChange = (values: number[]) => {
    setEndEffectorPosition((prev) => {
      const value = values.at(0);

      console.log(value);

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

  const sendAnglesToESP = () => {
    if (!angles || !apIP) {
      return;
    }

    const url = `http://${apIP}/angles?theta1=${angles.theta1}&theta2=${angles.theta2}&theta3=${angles.theta3}`;

    fetch(url, {
      method: "GET",
    });
  };

  return (
    <main className="flex flex-col justify-center items-center h-full">
      <section className="max-w-[512px] flex flex-col gap-4 justify-center items-center">
        <div>
          ESP32 AP IP:
          <Input
            value={apIP}
            onChange={handleInputChange}
            placeholder="Enter ESP IP"
          />
        </div>
        <div className="flex flex-col justify-center items-center gap-4">
          <div className="flex flex-col justify-center items-center gap-4 min-w-60">
            <Label className="text-center">X,Y Positions</Label>
            <Joystick
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
            <Label className="text-center" htmlFor="z-controller">
              Z Position
            </Label>

            <Slider
              id="z-controller"
              className="w-full"
              value={[endEffectorPosition.z]}
              onValueChange={handleSliderValueChange}
              step={0.01}
              min={MIN_END_EFFECTOR_Z}
              max={MAX_END_EFFECTOR_Z}
            />
          </div>
        </div>

        <Button onClick={handleReset}>Reset</Button>

        <div className="flex flex-col gap-2 min-w-60">
          <div>End effector position:</div>
          <div>x: {endEffectorPosition.x}</div>
          <div>y: {endEffectorPosition.y}</div>
          <div>z: {endEffectorPosition.z}</div>
        </div>

        <div className="flex flex-col gap-2 min-w-60">
          <div>Angle:</div>
          <div>Theta 1: {angles?.theta1}</div>
          <div>Theta 2: {angles?.theta2}</div>
          <div>Theta 3: {angles?.theta3}</div>
        </div>
      </section>
    </main>
  );
}

export default App;
