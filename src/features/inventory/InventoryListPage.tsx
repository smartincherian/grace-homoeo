import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { Link, useNavigate } from "react-router-dom";
import { useInventory, useSetQuantity, useDeleteItem } from "./useInventory";
import { isLowStock, type InventoryItem } from "./inventorySchema";
import OrderListSection from "./OrderListSection";
import QueryStates from "../../components/QueryStates";
import ListCard from "../../components/ListCard";
import RowMenu from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import AvatarTile from "../../components/AvatarTile";
import { CARD_SX, PILL_SX, TOKENS } from "../../theme/theme";
import { useToast } from "../../components/useToast";
import { useClinicPath } from "../auth/useClinicPath";

export default function InventoryListPage() {
  const cp = useClinicPath();
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

  const lowCount = (data ?? []).filter(isLowStock).length;

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
      <PageHeader
        title="Inventory"
        subtitle={
          data
            ? `${data.length} item${data.length === 1 ? "" : "s"} · ${lowCount} low on stock`
            : "Medicines and supplies"
        }
        actions={
          <TextField
            label="Search by name"
            size="small"
            sx={{
              width: { xs: "100%", md: 320 },
              "& .MuiOutlinedInput-root": { bgcolor: TOKENS.white },
            }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      />
      <OrderListSection />
      <Box
        component="section"
        sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 3 }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h2" sx={{ fontSize: 20, fontWeight: 700 }}>
            In Stock
          </Typography>
          {filtered.length > 0 && (
            <Box
              component="span"
              sx={{
                ...PILL_SX,
                py: 0.25,
                bgcolor: TOKENS.okBg,
                color: TOKENS.ok,
              }}
            >
              {filtered.length}
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            component={Link}
            to={cp("/inventory/new")}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ height: 40 }}
          >
            Add item
          </Button>
        </Stack>
        <QueryStates
          status={status}
          isEmpty={filtered.length === 0}
          emptyMessage="No items yet"
        >
          {filtered.map((i) => (
            <ListCard
              key={i.id}
              onClick={() => navigate(cp(`/inventory/${i.id}/edit`))}
              edgeColor={isLowStock(i) ? TOKENS.warn : undefined}
              avatar={<AvatarTile name={i.name} seed={i.name.length} />}
              primary={
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  component="span"
                >
                  <span>{i.name}</span>
                  {isLowStock(i) && (
                    <Box
                      component="span"
                      sx={{
                        ...PILL_SX,
                        py: 0.25,
                        bgcolor: TOKENS.warnBg,
                        color: TOKENS.warn,
                      }}
                    >
                      Low stock
                    </Box>
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
                  onEdit={() => navigate(cp(`/inventory/${i.id}/edit`))}
                  onDelete={() => setToDelete(i)}
                />
              }
            />
          ))}
        </QueryStates>
      </Box>
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
