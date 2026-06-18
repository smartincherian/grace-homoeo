import { useMemo, useState } from "react";
import {
  Box, Chip, Fab, IconButton, List, ListItem, ListItemButton, ListItemText,
  Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { Link, useNavigate } from "react-router-dom";
import { useInventory, useSetQuantity } from "./useInventory";
import { isLowStock, type InventoryItem } from "./inventorySchema";
import QueryStates from "../../components/QueryStates";
import { useToast } from "../../components/useToast";

export default function InventoryListPage() {
  const { status, data } = useInventory();
  const setQuantity = useSetQuantity();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
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
      { onError: () => showToast("Could not update quantity. Please try again.", "error") },
    );
  };

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Inventory</Typography>
      <TextField
        label="Search by name"
        fullWidth size="small" sx={{ mb: 2 }}
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates status={status} isEmpty={filtered.length === 0} emptyMessage="No items yet">
        <List>
          {filtered.map((i) => (
            <ListItem
              key={i.id} divider disableGutters
              secondaryAction={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <IconButton aria-label={`Decrease ${i.name}`} size="small"
                    disabled={i.quantity === 0 || setQuantity.isPending}
                    onClick={() => adjust(i, -1)}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography component="span" sx={{ minWidth: 24, textAlign: "center" }}>
                    {i.quantity}
                  </Typography>
                  <IconButton aria-label={`Increase ${i.name}`} size="small"
                    disabled={setQuantity.isPending}
                    onClick={() => adjust(i, 1)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemButton onClick={() => navigate(`/inventory/${i.id}/edit`)}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{i.name}</span>
                      {isLowStock(i) && <Chip label="Low stock" color="warning" size="small" />}
                    </Stack>
                  }
                  secondary={`${i.quantity}${i.unit ? ` ${i.unit}` : ""} in stock`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </QueryStates>
      <Fab color="primary" aria-label="Add item" component={Link} to="/inventory/new"
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
