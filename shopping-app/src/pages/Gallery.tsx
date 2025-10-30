import Grid from "@mui/material/Grid";
import {
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useStoresList } from "../lib/useStores";

export default function Gallery() {
  const { stores } = useStoresList();
  return (
    <Grid container spacing={2}>
      {stores.map((s) => (
        <Grid key={s.id} size={{ xs: 12, md: 6, lg: 4 }}>
          <Card>
            <CardActionArea component={Link} to={`/store/${s.id}`}>
              {s.cover && (
                <CardMedia
                  component="img"
                  image={s.cover}
                  alt={s.name}
                  sx={{ aspectRatio: "16/9", objectFit: "cover" }}
                />
              )}
              <CardContent>
                <Typography variant="h6">{s.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Tap to enter store
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
