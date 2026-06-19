import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useNavigate } from "react-router-dom";
import { useInventory, useSetQuantity, useDeleteItem } from "./useInventory";
import { isLowStock, type InventoryItem } from "./inventorySchema";
import QueryStates from "../../components/QueryStates";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import RowMenu from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSetPageTitle } from "../../components/PageChrome";
import { useToast } from "../../components/useToast";

export default function InventoryListPage() {
  useSetPageTitle("Inventory");
  const { status, data } = useInventory();
  const setQuantity = useSetQuantity();
  const deleteItem = useDeleteItem();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<InventoryItem | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((i) => i.nameLower.includes(q));
  }, [data, search]);

  const adjust = (item: InventoryItem, delta: number) => {
    const quantity = Math.max(0, item.quantity + delta);
    if (quantity === item.quantity) return;
    setQuantity.mutate(
      { id: item.id, quantity },
      {
        onError: () =>
          showToast("Could not update quantity. Please try again.", "error"),
      },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const item = toDelete;
    setToDelete(null);
    deleteItem.mutate(item.id, {
      onSuccess: () => showToast("Item deleted", "success"),
      onError: () =>
        showToast("Could not delete item. Please try again.", "error"),
    });
  };

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <TextField
        label="Search by name"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates
        status={status}
        isEmpty={filtered.length === 0}
        emptyMessage="No items yet"
      >
        {filtered.map((i) => (
          <ListCard
            key={i.id}
            onClick={() => navigate(`/inventory/${i.id}/edit`)}
            avatar={
              <Avatar
                sx={{ bgcolor: "#E6F7F3", color: "#0F8C7E", fontWeight: 700 }}
              >
                {i.name[0]?.toUpperCase()}
              </Avatar>
            }
            primary={
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                component="span"
              >
                <span>{i.name}</span>
                {isLowStock(i) && (
                  <Chip label="Low stock" color="warning" size="small" />
                )}
              </Stack>
            }
            secondary={`${i.quantity}${i.unit ? ` ${i.unit}` : ""} in stock`}
            trailing={
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  aria-label={`Decrease ${i.name}`}
                  size="small"
                  disabled={i.quantity === 0 || setQuantity.isPending}
                  onClick={() => adjust(i, -1)}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography
                  component="span"
                  sx={{ minWidth: 24, textAlign: "center" }}
                >
                  {i.quantity}
                </Typography>
                <IconButton
                  aria-label={`Increase ${i.name}`}
                  size="small"
                  disabled={setQuantity.isPending}
                  onClick={() => adjust(i, 1)}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
            menu={
              <RowMenu
                label={i.name}
                onEdit={() => navigate(`/inventory/${i.id}/edit`)}
                onDelete={() => setToDelete(i)}
              />
            }
          />
        ))}
      </QueryStates>
      <AddButton label="Add item" to="/inventory/new" />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete item?"
        message={
          toDelete ? `Delete "${toDelete.name}"? This cannot be undone.` : ""
        }
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
