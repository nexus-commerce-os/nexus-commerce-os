"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  Eyebrow,
  Modal,
  Select,
  ToastProvider,
  useToast,
} from "@nexus/ui";

function DemoCard({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ padding: "22px", display: "grid", gap: "16px" }}>
      <Eyebrow>{name}</Eyebrow>
      <div
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </Card>
  );
}

function SelectDemo() {
  const [region, setRegion] = useState("us");
  return (
    <div style={{ width: "100%", display: "grid", gap: "8px" }}>
      <Select
        ariaLabel="Ship-to region"
        value={region}
        onChange={setRegion}
        options={[
          { value: "us", label: "United States" },
          { value: "eu", label: "European Union" },
          { value: "bd", label: "Bangladesh" },
        ]}
      />
      <span className="muted mono">value: {region}</span>
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirm hand-off">
        <p className="muted" style={{ marginTop: 0 }}>
          The agent will send a signed, machine-readable offer to the merchant.
          Nothing is purchased on your behalf.
        </p>
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <Button onClick={() => setOpen(false)}>Confirm</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ToastButtons() {
  const { toast } = useToast();
  return (
    <>
      <Button onClick={() => toast("Saved to your watchlist.", { tone: "accent" })}>
        Success toast
      </Button>
      <Button
        variant="ghost"
        onClick={() => toast("Price check is still pending.", { tone: "warning" })}
      >
        Warning toast
      </Button>
    </>
  );
}

/** Client-only demos for the stateful primitives (Select, Modal, Toast). */
export function InteractiveDemos() {
  return (
    <ToastProvider>
      <DemoCard name="Select">
        <SelectDemo />
      </DemoCard>

      <DemoCard name="Modal">
        <ModalDemo />
      </DemoCard>

      <DemoCard name="Toast">
        <ToastButtons />
      </DemoCard>
    </ToastProvider>
  );
}
