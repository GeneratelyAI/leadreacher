"use client";

import type { ReactNode } from "react";
import { createContext, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import type {
  CreateTypes as ConfettiInstance,
  GlobalOptions as ConfettiGlobalOptions,
  Options as ConfettiOptions,
} from "canvas-confetti";

import { Button, type ButtonProps } from "@/components/ui/Button";

type Api = {
  fire: (options?: ConfettiOptions) => void;
};

type Props = React.ComponentPropsWithRef<"canvas"> & {
  options?: ConfettiOptions;
  globalOptions?: ConfettiGlobalOptions;
  manualstart?: boolean;
  children?: ReactNode;
};

export type ConfettiRef = Api | null;

const ConfettiContext = createContext<Api>({} as Api);
const defaultGlobalOptions: ConfettiGlobalOptions = { resize: true, useWorker: true };

const Confetti = forwardRef<ConfettiRef, Props>((props, ref) => {
  const { options, globalOptions = defaultGlobalOptions, manualstart = false, children, ...rest } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    if (node) {
      if (instanceRef.current) return;
      instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
      return;
    }
    instanceRef.current?.reset();
    instanceRef.current = null;
  }, [globalOptions]);

  const fire = useCallback((opts: ConfettiOptions = {}) => {
    instanceRef.current?.({ ...options, ...opts });
  }, [options]);

  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) fire();
  }, [manualstart, fire]);

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </ConfettiContext.Provider>
  );
});

interface ConfettiButtonProps extends ButtonProps {
  options?: ConfettiOptions & ConfettiGlobalOptions & { canvas?: HTMLCanvasElement };
  children?: ReactNode;
}

function ConfettiButton({ options, children, onClick, ...props }: ConfettiButtonProps) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const rect = event.currentTarget.getBoundingClientRect();
    confetti({
      ...options,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
    });
  };

  return <Button onClick={handleClick} {...props}>{children}</Button>;
}

Confetti.displayName = "Confetti";

export { Confetti, ConfettiButton };
