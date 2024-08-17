import { useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { Joystick } from "react-joystick-component";
import { type IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

function App() {
  const [socketUrl] = useState("wss://echo.websocket.org");

  const { readyState } = useWebSocket<string>(socketUrl);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const handleStart = (event: IJoystickUpdateEvent) => {
    console.log(event);
  };

  const handleMove = (event: IJoystickUpdateEvent) => {
    console.log(event);
  };

  const handleStop = (event: IJoystickUpdateEvent) => {
    console.log(event);
  };

  return (
    <main className="flex flex-col justify-center items-center h-full">
      <section className="max-w-96 flex flex-col justify-center items-center">
        <div>connection status: {connectionStatus}</div>

        <Joystick
          size={100}
          sticky={false}
          baseColor="red"
          stickColor="blue"
          move={handleMove}
          stop={handleStop}
          start={handleStart}
        />
        {/* <Slider max={100} step={1} /> */}
      </section>
    </main>
  );
}

export default App;
