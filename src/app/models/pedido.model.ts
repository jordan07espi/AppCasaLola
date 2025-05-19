export interface Cliente {
  id: number;
  nombre: string;
  cedula: string;
  telefono: string;
}

// Nueva interfaz para los productos base que se pueden pedir
export interface Producto {
  id: number; // Autoincremental PK
  nombre: string; // Ej: "Chancho", "Costilla", "Pavo", "Tortillas", etc. (Debe ser único)

}

// Estado del pedido
export enum EstadoPedido {
  PENDIENTE = 'PE',
  ENTREGADO = 'EN',
  CANCELADO = 'CA'
}

// Nueva interfaz para los ítems específicos de un pedido con su cantidad
export interface PedidoItem {
  id?: number; // Autoincremental PK (opcional si solo se usa al crear)
  pedido_id: number; // FK a Pedido.id
  producto_id: number; // FK a Producto.id
  cantidad: number;

  // Campos para mostrar (opcionales, se llenarían con JOINs)
  nombre_producto?: string;
}

export interface Pedido {
  id: number; // Autoincremental PK
  cliente_id: number; // FK a Clientes
  numero_tillo: string; // Ej: 2025_001 (Este es el que definimos como "Código del pedido (Tillo)")
  precio: number; // Precio total del pedido, ingresado por el administrador
  estado: EstadoPedido;
  fecha_entrega: string; // Formato ISO 8601: "YYYY-MM-DDTHH:mm:ss"
  fecha_actualizacion: string; // Formato ISO 8601
  fecha_creacion: string; // Formato ISO 8601
  observacion?: string;

  // Para mostrar en la lista de pedidos, puede ser una descripción generada
  // a partir de los PedidoItems.
  descripcion_trabajo_lista?: string;

  // Lista de ítems del pedido (se llenará al cargar un pedido específico)
  items?: PedidoItem[];

  // Campos que podrían ser útiles para mostrar en la lista, obtenidos con JOINs
  nombre_cliente?: string;
  cedula_cliente?: string;
}

// La tabla Guarnicion y pedidoGuarnicion de tu diagrama original
// no las estamos usando por ahora con este enfoque, pero las dejo comentadas
// por si en el futuro son relevantes para otro concepto.
// export interface PedidoGuarnicion {
//   id: number;
//   guarnicion_id: number;
//   pedido_id: number;
//   cantidad: number;
//   precio: number;
// }

// export interface Guarnicion {
//   id: number;
//   nombre: string;
// }