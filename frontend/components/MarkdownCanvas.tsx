"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Icon } from "@iconify/react";

// Claude/ChatGPT-style canvas: edit the RENDERED markdown directly (WYSIWYG),
// serialize back to markdown on change. The agent emits markdown, so we never
// show raw syntax to the user.
export default function MarkdownCanvas({
  initialMarkdown,
  editable = true,
  onChange,
  className,
}: {
  initialMarkdown: string;
  editable?: boolean;
  onChange?: (markdown: string) => void;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false, // avoid SSR hydration mismatch
    editable,
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: "canvas-prose focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const md = editor.storage as unknown as Record<string, { getMarkdown: () => string }>;
      onChange?.(md.markdown.getMarkdown());
    },
  });

  // Keep editability in sync if the prop flips.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-32">
        <div
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: "#E8472A" }}
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {editable && <CanvasToolbar editor={editor} />}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function CanvasToolbar({ editor }: { editor: Editor }) {
  const btn = "flex items-center justify-center w-8 h-8 bouncy shrink-0";
  const style = (active: boolean) => ({
    background: active ? "#0D0D0D" : "transparent",
    color: active ? "#FFFFFF" : "#5A5A5A",
    border: "1.5px solid transparent",
    borderRadius: "4px",
  });

  const items: {
    icon: string;
    title: string;
    run: () => void;
    active: () => boolean;
  }[] = [
    {
      icon: "solar:text-bold-bold",
      title: "Bold",
      run: () => editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive("bold"),
    },
    {
      icon: "solar:text-italic-bold",
      title: "Italic",
      run: () => editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive("italic"),
    },
    {
      icon: "solar:text-square-bold",
      title: "Heading 1",
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: () => editor.isActive("heading", { level: 1 }),
    },
    {
      icon: "solar:text-square-2-bold",
      title: "Heading 2",
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor.isActive("heading", { level: 2 }),
    },
    {
      icon: "solar:list-bold",
      title: "Bullet list",
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: () => editor.isActive("bulletList"),
    },
    {
      icon: "solar:list-arrow-down-bold",
      title: "Numbered list",
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: () => editor.isActive("orderedList"),
    },
    {
      icon: "solar:quote-up-bold",
      title: "Quote",
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: () => editor.isActive("blockquote"),
    },
    {
      icon: "solar:code-bold",
      title: "Code block",
      run: () => editor.chain().focus().toggleCodeBlock().run(),
      active: () => editor.isActive("codeBlock"),
    },
  ];

  return (
    <div
      className="flex items-center gap-1 flex-wrap p-2 shrink-0"
      style={{ borderBottom: "2px solid #0D0D0D", background: "#FFFFFF" }}
    >
      {items.map((it) => (
        <button
          key={it.title}
          type="button"
          title={it.title}
          onClick={it.run}
          className={btn}
          style={style(it.active())}
          onMouseEnter={(e) => {
            if (!it.active()) e.currentTarget.style.background = "#EDE6D3";
          }}
          onMouseLeave={(e) => {
            if (!it.active()) e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon icon={it.icon} width={15} />
        </button>
      ))}
      <div className="flex-1" />
      <button
        type="button"
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        className={btn}
        style={style(false)}
      >
        <Icon icon="solar:undo-left-bold" width={15} />
      </button>
      <button
        type="button"
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        className={btn}
        style={style(false)}
      >
        <Icon icon="solar:undo-right-bold" width={15} />
      </button>
    </div>
  );
}
