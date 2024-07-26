import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const InventoryPage = () => {
  const [inventory, setInventory] = useState([
    { name: "Aspirin", quantity: 100, reorderLevel: 50 },
    { name: "Bandages", quantity: 34, reorderLevel: 20 },
    { name: "Antibiotic Cream", quantity: 15, reorderLevel: 10 },
  ]);
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "",
    reorderLevel: "",
  });

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAddItem = () => {
    const newItemWithId = {
      ...newItem,
      id: inventory.length + 1,
      quantity: parseInt(newItem.quantity),
      reorderLevel: parseInt(newItem.reorderLevel),
    };
    setInventory([...inventory, newItemWithId]);
    handleClose();
    setNewItem({ name: "", quantity: "", reorderLevel: "" });
  };

  const handleDeleteItem = (id) => {
    setInventory(inventory.filter((item) => item.id !== id));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setNewItem({ ...newItem, [name]: value });
  };

  return (
    <div>
      <Button variant="contained" color="primary" onClick={handleClickOpen}>
        Add New Item
      </Button>
      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Reorder Level</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventory.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.reorderLevel}</TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add a New Inventory Item</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Item Name"
            type="text"
            fullWidth
            variant="standard"
            name="name"
            value={newItem.name}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            id="quantity"
            label="Quantity"
            type="number"
            fullWidth
            variant="standard"
            name="quantity"
            value={newItem.quantity}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            id="reorderLevel"
            label="Reorder Level"
            type="number"
            fullWidth
            variant="standard"
            name="reorderLevel"
            value={newItem.reorderLevel}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAddItem}>Add</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
