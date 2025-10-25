export type FieldType = 'text' | 'numeric' | 'selector' | 'radio';

export interface CustomField {
  id: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  options?: string[]; // For selector and radio
  order: number;
}

export interface DonorFormConfig {
  customFields: CustomField[];
  createdAt: Date;
  updatedAt: Date;
}
