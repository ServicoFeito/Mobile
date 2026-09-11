export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anexos_mensagem: {
        Row: {
          created_at: string
          id: string
          mensagem_id: string
          nome_arquivo: string | null
          tamanho: number
          tipo_arquivo: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem_id: string
          nome_arquivo?: string | null
          tamanho?: number
          tipo_arquivo?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem_id?: string
          nome_arquivo?: string | null
          tamanho?: number
          tipo_arquivo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_mensagem_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          avaliador_id: string
          comentario: string | null
          contratacao_id: string
          cordialidade: boolean
          created_at: string
          id: string
          nota: number
          pontualidade: boolean
          prestador_id: string
          qualidade: boolean
        }
        Insert: {
          avaliador_id: string
          comentario?: string | null
          contratacao_id: string
          cordialidade?: boolean
          created_at?: string
          id?: string
          nota: number
          pontualidade?: boolean
          prestador_id: string
          qualidade?: boolean
        }
        Update: {
          avaliador_id?: string
          comentario?: string | null
          contratacao_id?: string
          cordialidade?: boolean
          created_at?: string
          id?: string
          nota?: number
          pontualidade?: boolean
          prestador_id?: string
          qualidade?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "avaliacoes_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_servico: {
        Row: {
          created_at: string
          descricao: string | null
          icone_key: string
          id: string
          nome: string
          popular: boolean
          preco_medio_hora: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          icone_key: string
          id?: string
          nome: string
          popular?: boolean
          preco_medio_hora?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          icone_key?: string
          id?: string
          nome?: string
          popular?: boolean
          preco_medio_hora?: number
        }
        Relationships: []
      }
      contratacoes: {
        Row: {
          avaliado: boolean
          cliente_id: string
          created_at: string
          data_agendada: string | null
          data_conclusao: string | null
          demanda_id: string | null
          entrada_paga: boolean
          final_pago: boolean
          id: string
          prestador_id: string
          proposta_id: string
          status: Database["public"]["Enums"]["status_contratacao"]
          taxa_plataforma: number | null
          titulo_servico: string
          updated_at: string
          valor_entrada: number | null
          valor_final: number | null
          valor_total: number
        }
        Insert: {
          avaliado?: boolean
          cliente_id: string
          created_at?: string
          data_agendada?: string | null
          data_conclusao?: string | null
          demanda_id?: string | null
          entrada_paga?: boolean
          final_pago?: boolean
          id?: string
          prestador_id: string
          proposta_id: string
          status?: Database["public"]["Enums"]["status_contratacao"]
          taxa_plataforma?: number | null
          titulo_servico: string
          updated_at?: string
          valor_entrada?: number | null
          valor_final?: number | null
          valor_total: number
        }
        Update: {
          avaliado?: boolean
          cliente_id?: string
          created_at?: string
          data_agendada?: string | null
          data_conclusao?: string | null
          demanda_id?: string | null
          entrada_paga?: boolean
          final_pago?: boolean
          id?: string
          prestador_id?: string
          proposta_id?: string
          status?: Database["public"]["Enums"]["status_contratacao"]
          taxa_plataforma?: number | null
          titulo_servico?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_final?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "contratacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "contratacoes_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: true
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          cliente_id: string
          created_at: string
          data_ultima_mensagem: string | null
          demanda_id: string | null
          id: string
          nao_lidas_cliente: number
          nao_lidas_prestador: number
          prestador_id: string
          status: Database["public"]["Enums"]["status_conversa"]
          tipo: Database["public"]["Enums"]["tipo_conversa"]
          ultima_mensagem: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_ultima_mensagem?: string | null
          demanda_id?: string | null
          id?: string
          nao_lidas_cliente?: number
          nao_lidas_prestador?: number
          prestador_id: string
          status?: Database["public"]["Enums"]["status_conversa"]
          tipo: Database["public"]["Enums"]["tipo_conversa"]
          ultima_mensagem?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_ultima_mensagem?: string | null
          demanda_id?: string | null
          id?: string
          nao_lidas_cliente?: number
          nao_lidas_prestador?: number
          prestador_id?: string
          status?: Database["public"]["Enums"]["status_conversa"]
          tipo?: Database["public"]["Enums"]["tipo_conversa"]
          ultima_mensagem?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "conversas_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas_servico: {
        Row: {
          categoria_id: string
          cliente_id: string
          created_at: string
          data_desejada: string | null
          descricao: string
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_completo: string | null
          id: string
          orcamento_maximo: number | null
          status: Database["public"]["Enums"]["status_demanda"]
          titulo: string
          total_propostas: number
          updated_at: string
          urgencia: string
        }
        Insert: {
          categoria_id: string
          cliente_id: string
          created_at?: string
          data_desejada?: string | null
          descricao: string
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          id?: string
          orcamento_maximo?: number | null
          status?: Database["public"]["Enums"]["status_demanda"]
          titulo: string
          total_propostas?: number
          updated_at?: string
          urgencia?: string
        }
        Update: {
          categoria_id?: string
          cliente_id?: string
          created_at?: string
          data_desejada?: string | null
          descricao?: string
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          id?: string
          orcamento_maximo?: number | null
          status?: Database["public"]["Enums"]["status_demanda"]
          titulo?: string
          total_propostas?: number
          updated_at?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_servico_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "demandas_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade_prestador: {
        Row: {
          dom: boolean
          qua: boolean
          qui: boolean
          sab: boolean
          seg: boolean
          sex: boolean
          ter: boolean
          updated_at: string
          usuario_id: string
        }
        Insert: {
          dom?: boolean
          qua?: boolean
          qui?: boolean
          sab?: boolean
          seg?: boolean
          sex?: boolean
          ter?: boolean
          updated_at?: string
          usuario_id: string
        }
        Update: {
          dom?: boolean
          qua?: boolean
          qui?: boolean
          sab?: boolean
          seg?: boolean
          sex?: boolean
          ter?: boolean
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidade_prestador_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfil_prestador"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      enderecos_usuario: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          estado: string | null
          id: string
          identificacao: string | null
          logradouro: string | null
          numero: string | null
          principal: boolean
          updated_at: string
          usuario_id: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          identificacao?: string | null
          logradouro?: string | null
          numero?: string | null
          principal?: boolean
          updated_at?: string
          usuario_id: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          identificacao?: string | null
          logradouro?: string | null
          numero?: string | null
          principal?: boolean
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "enderecos_usuario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      licencas_certificados: {
        Row: {
          cod_credencial: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          instituicao: string | null
          titulo: string
          url_imagem: string | null
          usuario_id: string
        }
        Insert: {
          cod_credencial?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          instituicao?: string | null
          titulo: string
          url_imagem?: string | null
          usuario_id: string
        }
        Update: {
          cod_credencial?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          instituicao?: string | null
          titulo?: string
          url_imagem?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licencas_certificados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "licencas_certificados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          conversa_id: string
          corpo: string
          created_at: string
          id: string
          lida: boolean
          proposta_id: string | null
          remetente_id: string
          tipo: Database["public"]["Enums"]["tipo_mensagem"]
        }
        Insert: {
          conversa_id: string
          corpo?: string
          created_at?: string
          id?: string
          lida?: boolean
          proposta_id?: string | null
          remetente_id: string
          tipo?: Database["public"]["Enums"]["tipo_mensagem"]
        }
        Update: {
          conversa_id?: string
          corpo?: string
          created_at?: string
          id?: string
          lida?: boolean
          proposta_id?: string | null
          remetente_id?: string
          tipo?: Database["public"]["Enums"]["tipo_mensagem"]
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacao"]
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          contratacao_id: string
          created_at: string
          data_pagamento: string | null
          efi_loc_id: number | null
          gateway: string
          id: string
          pix_copia_cola: string | null
          qr_code_base64: string | null
          status: Database["public"]["Enums"]["status_pagamento"]
          tipo: Database["public"]["Enums"]["tipo_pagamento"]
          txid: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          contratacao_id: string
          created_at?: string
          data_pagamento?: string | null
          efi_loc_id?: number | null
          gateway?: string
          id?: string
          pix_copia_cola?: string | null
          qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["status_pagamento"]
          tipo: Database["public"]["Enums"]["tipo_pagamento"]
          txid?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          contratacao_id?: string
          created_at?: string
          data_pagamento?: string | null
          efi_loc_id?: number | null
          gateway?: string
          id?: string
          pix_copia_cola?: string | null
          qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["status_pagamento"]
          tipo?: Database["public"]["Enums"]["tipo_pagamento"]
          txid?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes_conversa: {
        Row: {
          conversa_id: string
          papel: string
          usuario_id: string
        }
        Insert: {
          conversa_id: string
          papel: string
          usuario_id: string
        }
        Update: {
          conversa_id?: string
          papel?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participantes_conversa_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_conversa_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "participantes_conversa_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_prestador: {
        Row: {
          bio: string | null
          chave_pix: string | null
          cnpj_mei: string | null
          created_at: string
          disponivel: boolean
          documento_verificado: boolean
          preco_base: number
          raio_km: number
          rating: number
          selo_fundador: boolean
          tem_mei: boolean
          tempo_experiencia: string | null
          titulo_profissional: string | null
          total_avaliacoes: number
          total_servicos: number
          updated_at: string
          usuario_id: string
          verificado: boolean
        }
        Insert: {
          bio?: string | null
          chave_pix?: string | null
          cnpj_mei?: string | null
          created_at?: string
          disponivel?: boolean
          documento_verificado?: boolean
          preco_base?: number
          raio_km?: number
          rating?: number
          selo_fundador?: boolean
          tem_mei?: boolean
          tempo_experiencia?: string | null
          titulo_profissional?: string | null
          total_avaliacoes?: number
          total_servicos?: number
          updated_at?: string
          usuario_id: string
          verificado?: boolean
        }
        Update: {
          bio?: string | null
          chave_pix?: string | null
          cnpj_mei?: string | null
          created_at?: string
          disponivel?: boolean
          documento_verificado?: boolean
          preco_base?: number
          raio_km?: number
          rating?: number
          selo_fundador?: boolean
          tem_mei?: boolean
          tempo_experiencia?: string | null
          titulo_profissional?: string | null
          total_avaliacoes?: number
          total_servicos?: number
          updated_at?: string
          usuario_id?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "perfil_prestador_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "perfil_prestador_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_prestador: {
        Row: {
          created_at: string
          id: string
          prestador_id: string
          url_media: string
        }
        Insert: {
          created_at?: string
          id?: string
          prestador_id: string
          url_media: string
        }
        Update: {
          created_at?: string
          id?: string
          prestador_id?: string
          url_media?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_prestador_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "perfil_prestador"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      prestador_categoria: {
        Row: {
          categoria_id: string
          prestador_id: string
        }
        Insert: {
          categoria_id: string
          prestador_id: string
        }
        Update: {
          categoria_id?: string
          prestador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestador_categoria_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_categoria_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "perfil_prestador"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      propostas: {
        Row: {
          cliente_id: string
          conversa_id: string
          created_at: string
          demanda_id: string | null
          descricao: string
          id: string
          prazo_execucao: string | null
          prestador_id: string
          status: Database["public"]["Enums"]["status_proposta"]
          tarefas_ids: string | null
          taxa_plataforma: number | null
          updated_at: string
          validade_dias: number
          valor: number
          valor_liquido_prestador: number | null
        }
        Insert: {
          cliente_id: string
          conversa_id: string
          created_at?: string
          demanda_id?: string | null
          descricao?: string
          id?: string
          prazo_execucao?: string | null
          prestador_id: string
          status?: Database["public"]["Enums"]["status_proposta"]
          tarefas_ids?: string | null
          taxa_plataforma?: number | null
          updated_at?: string
          validade_dias?: number
          valor: number
          valor_liquido_prestador?: number | null
        }
        Update: {
          cliente_id?: string
          conversa_id?: string
          created_at?: string
          demanda_id?: string | null
          descricao?: string
          id?: string
          prazo_execucao?: string | null
          prestador_id?: string
          status?: Database["public"]["Enums"]["status_proposta"]
          tarefas_ids?: string | null
          taxa_plataforma?: number | null
          updated_at?: string
          validade_dias?: number
          valor?: number
          valor_liquido_prestador?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "perfis_publicos"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "propostas_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_demanda: {
        Row: {
          concluida: boolean
          created_at: string
          demanda_id: string
          descricao: string | null
          id: string
          nome_tarefa: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          demanda_id: string
          descricao?: string | null
          id?: string
          nome_tarefa: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          demanda_id?: string
          descricao?: string | null
          id?: string
          nome_tarefa?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_demanda_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          avatar_cor_hex: string
          bairro: string | null
          cidade: string | null
          created_at: string
          foto_perfil_url: string | null
          id: string
          nome: string | null
          rating_cliente: number
          status_conta: string
          telefone: string | null
          total_contratacoes_cliente: number
          updated_at: string
        }
        Insert: {
          avatar_cor_hex?: string
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          foto_perfil_url?: string | null
          id: string
          nome?: string | null
          rating_cliente?: number
          status_conta?: string
          telefone?: string | null
          total_contratacoes_cliente?: number
          updated_at?: string
        }
        Update: {
          avatar_cor_hex?: string
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          foto_perfil_url?: string | null
          id?: string
          nome?: string | null
          rating_cliente?: number
          status_conta?: string
          telefone?: string | null
          total_contratacoes_cliente?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      perfis_publicos: {
        Row: {
          avatar_cor_hex: string | null
          bairro: string | null
          bio: string | null
          cidade: string | null
          disponivel: boolean | null
          foto_perfil_url: string | null
          nome: string | null
          preco_base: number | null
          raio_km: number | null
          rating: number | null
          rating_cliente: number | null
          titulo_profissional: string | null
          total_avaliacoes: number | null
          total_servicos: number | null
          usuario_id: string | null
          verificado: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_aceitar_proposta: {
        Args: { p_proposta_id: string }
        Returns: string
      }
      fn_cancelar_contratacao: {
        Args: { p_contratacao_id: string }
        Returns: undefined
      }
      fn_e_participante: { Args: { p_conversa_id: string }; Returns: boolean }
      fn_recusar_proposta: {
        Args: { p_proposta_id: string }
        Returns: undefined
      }
      fn_tem_perfil_prestador: {
        Args: { p_usuario_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      status_contratacao:
        | "AGUARDANDO_PAGAMENTO"
        | "AGENDADA"
        | "EM_ANDAMENTO"
        | "CONCLUIDA"
        | "CANCELADA"
      status_conversa: "ATIVA" | "ENCERRADA" | "BLOQUEADA"
      status_demanda:
        | "ABERTA"
        | "EM_NEGOCIACAO"
        | "CONTRATADA"
        | "FINALIZADA"
        | "CANCELADA"
      status_pagamento:
        | "PENDENTE"
        | "PROCESSANDO"
        | "PAGO"
        | "CANCELADO"
        | "EXPIRADO"
      status_proposta:
        | "ENVIADA"
        | "VISUALIZADA"
        | "ACEITA"
        | "RECUSADA"
        | "CANCELADA"
        | "EXPIRADA"
      tipo_conversa: "DEMANDA" | "DIRETA"
      tipo_mensagem:
        | "TEXTO"
        | "AUDIO"
        | "VIDEO"
        | "FOTO"
        | "LOCALIZACAO"
        | "PROPOSTA"
        | "CONTRATO_GERADO"
        | "PAGAMENTO_CONFIRMADO"
        | "SISTEMA"
      tipo_notificacao:
        | "PROPOSTA"
        | "PAGAMENTO"
        | "MENSAGEM"
        | "CONTRATACAO"
        | "AVALIACAO"
      tipo_pagamento: "ENTRADA" | "FINAL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      status_contratacao: [
        "AGUARDANDO_PAGAMENTO",
        "AGENDADA",
        "EM_ANDAMENTO",
        "CONCLUIDA",
        "CANCELADA",
      ],
      status_conversa: ["ATIVA", "ENCERRADA", "BLOQUEADA"],
      status_demanda: [
        "ABERTA",
        "EM_NEGOCIACAO",
        "CONTRATADA",
        "FINALIZADA",
        "CANCELADA",
      ],
      status_pagamento: [
        "PENDENTE",
        "PROCESSANDO",
        "PAGO",
        "CANCELADO",
        "EXPIRADO",
      ],
      status_proposta: [
        "ENVIADA",
        "VISUALIZADA",
        "ACEITA",
        "RECUSADA",
        "CANCELADA",
        "EXPIRADA",
      ],
      tipo_conversa: ["DEMANDA", "DIRETA"],
      tipo_mensagem: [
        "TEXTO",
        "AUDIO",
        "VIDEO",
        "FOTO",
        "LOCALIZACAO",
        "PROPOSTA",
        "CONTRATO_GERADO",
        "PAGAMENTO_CONFIRMADO",
        "SISTEMA",
      ],
      tipo_notificacao: [
        "PROPOSTA",
        "PAGAMENTO",
        "MENSAGEM",
        "CONTRATACAO",
        "AVALIACAO",
      ],
      tipo_pagamento: ["ENTRADA", "FINAL"],
    },
  },
} as const
