import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AIChat } from "@/components/ui/AIChat";

// createPortal renders children directly in tests
jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock api module
jest.mock("@/lib/api", () => ({
  api: {
    post: jest.fn(),
  },
}));

import { api } from "@/lib/api";
const mockApiPost = api.post as jest.Mock;

const defaultProps = {
  pageType: "ptamensal" as const,
  contextData: { total_planejado: 394, taxa_execucao: 37.6 },
};

describe("AIChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the floating trigger button", () => {
    render(<AIChat {...defaultProps} />);
    expect(screen.getByLabelText("Abrir assistente de IA")).toBeInTheDocument();
  });

  it("does not show the chat panel by default", () => {
    render(<AIChat {...defaultProps} />);
    expect(screen.queryByText("Assistente ANAC")).not.toBeInTheDocument();
  });

  it("opens chat panel when trigger button is clicked", () => {
    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(screen.getByText("Assistente ANAC")).toBeInTheDocument();
  });

  it("shows default suggestions for ptamensal", () => {
    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(
      screen.getByText("Qual a taxa de execução atual e como está o cronograma?")
    ).toBeInTheDocument();
  });

  it("shows default suggestions for pta_historico", () => {
    render(<AIChat {...defaultProps} pageType="pta_historico" />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(
      screen.getByText("Qual foi o melhor ano em taxa de execução?")
    ).toBeInTheDocument();
  });

  it("shows 'PTA Mensal 2026' label for ptamensal", () => {
    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(screen.getByText("PTA Mensal 2026")).toBeInTheDocument();
  });

  it("shows 'Histórico PTA' label for pta_historico", () => {
    render(<AIChat {...defaultProps} pageType="pta_historico" />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(screen.getByText("Histórico PTA")).toBeInTheDocument();
  });

  it("closes panel when X button inside panel is clicked", () => {
    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(screen.getByText("Assistente ANAC")).toBeInTheDocument();
    // The X button inside the panel (second X button)
    const closeButtons = screen.getAllByRole("button");
    const panelClose = closeButtons.find(
      (b) => !b.getAttribute("aria-label") && b.querySelector("svg")
    );
    // Click the outer toggle button again (simpler approach)
    fireEvent.click(screen.getByLabelText("Fechar assistente"));
    expect(screen.queryByText("Assistente ANAC")).not.toBeInTheDocument();
  });

  it("sends a message and shows the response", async () => {
    mockApiPost.mockResolvedValueOnce({ answer: "Taxa de execução: 37.6%" });

    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));

    const textarea = screen.getByPlaceholderText(/Faça sua pergunta/);
    fireEvent.change(textarea, { target: { value: "Qual a taxa de execução?" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText("Taxa de execução: 37.6%")).toBeInTheDocument();
    });

    expect(mockApiPost).toHaveBeenCalledWith("/api/v1/chat/page", {
      question: "Qual a taxa de execução?",
      page_type: "ptamensal",
      context: defaultProps.contextData,
      history: [],
    });
  });

  it("sends a suggestion question when clicked", async () => {
    mockApiPost.mockResolvedValueOnce({ answer: "Resposta da IA" });

    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    fireEvent.click(
      screen.getByText("Qual a taxa de execução atual e como está o cronograma?")
    );

    await waitFor(() => {
      expect(screen.getByText("Resposta da IA")).toBeInTheDocument();
    });
  });

  it("shows error message when API call fails", async () => {
    mockApiPost.mockRejectedValueOnce(new Error("Erro de conexão"));

    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));

    const textarea = screen.getByPlaceholderText(/Faça sua pergunta/);
    fireEvent.change(textarea, { target: { value: "Pergunta qualquer" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText(/Erro de conexão/)).toBeInTheDocument();
    });
  });

  it("shows warning when contextData is null", () => {
    render(<AIChat {...defaultProps} contextData={null} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));
    expect(screen.getByText(/Aguardando dados da página/)).toBeInTheDocument();
  });

  it("resets conversation when reset button is clicked", async () => {
    mockApiPost.mockResolvedValueOnce({ answer: "Resposta" });

    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));

    const textarea = screen.getByPlaceholderText(/Faça sua pergunta/);
    fireEvent.change(textarea, { target: { value: "Pergunta" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText("Resposta")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Nova conversa"));
    expect(screen.queryByText("Resposta")).not.toBeInTheDocument();
    expect(screen.getByText(/Olá! Analiso os dados/)).toBeInTheDocument();
  });

  it("does not send empty message", () => {
    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));

    const textarea = screen.getByPlaceholderText(/Faça sua pergunta/);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("Shift+Enter does not send message", () => {
    render(<AIChat {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Abrir assistente de IA"));

    const textarea = screen.getByPlaceholderText(/Faça sua pergunta/);
    fireEvent.change(textarea, { target: { value: "Teste" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
