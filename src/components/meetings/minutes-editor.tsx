"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { motion } from "framer-motion";
import { cn, faNum } from "@/lib";


/**
 * محدود و فارسی — ادیتور صورت‌جلسه
 * Bubble menu on selection + a slim toolbar. Saves plain HTML.
 */
export function MinutesEditor({
  value,
  onChange,
  disabled,
  placeholder = "متن صورت‌جلسه را این‌جا بنویسید…",
  minHeight = 260,
  charLimit = 8000,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
  charLimit?: number;
}) {
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["right", "center", "justify"] }),
      Placeholder.configure({ placeholder, showOnlyWhenEditable: true }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        dir: "rtl",
        class: "prose-mehrsa min-h-full px-3.5 py-3 text-[13px] leading-7 text-ink outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const text = e.getText();
      if (text.length > charLimit) {
        // hard cap — drop the last change
        e.commands.deleteRange({ from: text.length - charLimit, to: e.state.selection.to });
        return;
      }
      onChange(e.getHTML());
    },
  });

  // lock/unlock when the FINAL status flips
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const charCount = editor ? editor.getText().length : 0;

  if (!editor) return null;

  const Btn = ({
    onClick, active, disabled: dis, title, children,
  }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      disabled={dis}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-soft hover:text-ink",
        dis && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-white", disabled && "bg-paper-soft/60")}>
      {/* slim toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-paper-soft/50 px-2 py-1.5">
        <Btn title="بولد" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="text-[13px] font-black">B</span>
        </Btn>
        <Btn title="ایتالیک" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="text-[13px] font-serif italic">I</span>
        </Btn>
        <Btn title="زیرخط" active={editor.isActive("underline")} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="text-[13px] font-medium underline">U</span>
        </Btn>
        <Btn title="خط‌خورده" active={editor.isActive("strike")} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="text-[13px] line-through">S</span>
        </Btn>
        <span className="mx-1 h-5 w-px bg-line" />
        <Btn title="عنوان" active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="text-[12px] font-bold">H2</span>
        </Btn>
        <Btn title="عنوان کوچک" active={editor.isActive("heading", { level: 3 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <span className="text-[12px] font-bold">H3</span>
        </Btn>
        <span className="mx-1 h-5 w-px bg-line" />
        <Btn title="فهرست نقطه‌ای" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <span className="text-[15px] leading-none">•</span>
        </Btn>
        <Btn title="فهرست شماره‌دار" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <span className="text-[12px] leading-none">۱.</span>
        </Btn>
        <span className="mx-1 h-5 w-px bg-line" />
        <Btn title="راست‌چین (پیش‌فرض)" active={editor.isActive({ textAlign: "right" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <span className="text-[13px]">≡⇥</span>
        </Btn>
        <Btn title="وسط‌چین" active={editor.isActive({ textAlign: "center" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <span className="text-[13px]">≡</span>
        </Btn>
        <Btn title="تراز دوطرفه" active={editor.isActive({ textAlign: "justify" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <span className="text-[13px]">☰</span>
        </Btn>
        <span className="mr-auto shrink-0 pl-2 text-[10.5px] tabular-nums text-ink-faint">
          {faNum(charCount)}/{faNum(charLimit)}
        </span>
      </div>

      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="relative"
      />

      {/* bubble menu on selection */}
      {!disabled && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 8 }}
          className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
        >
          <Btn title="بولد" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <span className="text-[13px] font-black">B</span>
          </Btn>
          <Btn title="ایتالیک" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <span className="text-[13px] font-serif italic">I</span>
          </Btn>
          <Btn title="زیرخط" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span className="text-[13px] font-medium underline">U</span>
          </Btn>
          <Btn title="خط‌خورده" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <span className="text-[13px] line-through">S</span>
          </Btn>
        </BubbleMenu>
      )}
    </div>
  );
}

/** Render saved minutes HTML read-only */
export function MinutesHtml({ html }: { html: string }) {
  return (
    <div
      dir="rtl"
      className="prose-mehrsa rounded-lg border border-line bg-paper-soft/40 p-4 text-[13px] leading-7 text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
