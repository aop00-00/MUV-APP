// app/services/product.server.ts
import { supabaseAdmin } from "./supabase.server";
import type { Product, ProductCategory } from "~/types/database";

export async function upsertProduct(gymId: string, product: Partial<Product>) {
    const { id, ...data } = product;
    
    if (id) {
        // Update
        const { data: updated, error } = await supabaseAdmin
            .from("products")
            .update({
                ...data,
                gym_id: gymId,
            })
            .eq("id", id)
            .eq("gym_id", gymId)
            .select()
            .single();

        if (error) throw new Error(`Error updating product: ${error.message}`);
        return updated;
    } else {
        // Insert
        const { data: inserted, error } = await supabaseAdmin
            .from("products")
            .insert({
                ...data,
                gym_id: gymId,
                is_active: data.is_active ?? true,
            })
            .select()
            .single();

        if (error) throw new Error(`Error creating product: ${error.message}`);
        return inserted;
    }
}

export async function deleteProduct(gymId: string, productId: string) {
    const { error } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting product: ${error.message}`);
}

export async function toggleProductActive(gymId: string, productId: string, isActive: boolean) {
    const { error } = await supabaseAdmin
        .from("products")
        .update({ is_active: isActive })
        .eq("id", productId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error toggling product status: ${error.message}`);
}
